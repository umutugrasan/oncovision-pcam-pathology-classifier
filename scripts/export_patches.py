"""
PCam .h5 test setinden rastgele N patch'i PNG olarak dışa aktarır.
Arayüzü test etmek için kullan: pozitif (kanserli) ve negatif (sağlıklı)
örnekleri AYRI klasörlere koyar, böylece doğru/yanlış tahminleri görürsün.

Kullanım:
    python export_patches.py --n 20 --out test_patches

Gerekli paketler: h5py, numpy, pillow
    pip install h5py numpy pillow
"""
import os
import argparse
import random

import h5py
import numpy as np
from PIL import Image

TEST_X = "data/camelyonpatch_level_2_split_test_x.h5"
TEST_Y = "data/camelyonpatch_level_2_split_test_y.h5"


def export(n: int, out_dir: str, seed: int = 42):
    if not (os.path.exists(TEST_X) and os.path.exists(TEST_Y)):
        raise FileNotFoundError(
            f"Test dosyaları bulunamadı:\n  {TEST_X}\n  {TEST_Y}\n"
            "Bu script'i proje kök dizininde çalıştır."
        )

    random.seed(seed)
    tumor_dir = os.path.join(out_dir, "kanserli")
    healthy_dir = os.path.join(out_dir, "saglikli")
    os.makedirs(tumor_dir, exist_ok=True)
    os.makedirs(healthy_dir, exist_ok=True)

    with h5py.File(TEST_X, "r") as fx, h5py.File(TEST_Y, "r") as fy:
        images = fx["x"]          # (N, 96, 96, 3)
        labels = fy["y"]          # (N, 1, 1, 1)
        total = images.shape[0]

        # n/2 kanserli + n/2 sağlıklı toplamak için rastgele indexleri tara
        indices = list(range(total))
        random.shuffle(indices)

        n_each = max(1, n // 2)
        saved_t, saved_h = 0, 0

        for idx in indices:
            if saved_t >= n_each and saved_h >= n_each:
                break
            label = int(np.array(labels[idx]).flatten()[0])  # 0 veya 1
            img_arr = np.array(images[idx]).astype(np.uint8)  # (96,96,3)
            img = Image.fromarray(img_arr, mode="RGB")

            if label == 1 and saved_t < n_each:
                img.save(os.path.join(tumor_dir, f"kanserli_{idx}.png"))
                saved_t += 1
            elif label == 0 and saved_h < n_each:
                img.save(os.path.join(healthy_dir, f"saglikli_{idx}.png"))
                saved_h += 1

    print(f"Bitti! {saved_t} kanserli + {saved_h} saglikli patch kaydedildi.")
    print(f"  -> {tumor_dir}")
    print(f"  -> {healthy_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="PCam .h5 -> PNG dışa aktarıcı")
    parser.add_argument("--n", type=int, default=20,
                        help="Toplam patch sayısı (yarısı kanserli, yarısı sağlıklı)")
    parser.add_argument("--out", type=str, default="test_patches",
                        help="Çıktı klasörü")
    parser.add_argument("--seed", type=int, default=42, help="Rastgelelik tohumu")
    args = parser.parse_args()
    export(args.n, args.out, args.seed)
