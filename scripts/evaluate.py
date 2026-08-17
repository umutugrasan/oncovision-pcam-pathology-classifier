import os
import torch
import h5py
from torch.utils.data import DataLoader
from torchvision import transforms
import matplotlib.pyplot as plt
from dataset import PatchCamelyonDataset, val_transforms
from train import build_model

def evaluate_model(model_name="resnet18"):
    device = torch.device("cpu")
    print(f"Test Cihazı: {device}")
    
    # 1. Test Verisini Yükleme
    test_x = "data/camelyonpatch_level_2_split_test_x.h5"
    test_y = "data/camelyonpatch_level_2_split_test_y.h5"
    
    if not os.path.exists(test_x):
        print("Test dosyaları bulunamadı!")
        return
        
    test_dataset = PatchCamelyonDataset(test_x, test_y, transform=val_transforms)
    
    
    test_loader = DataLoader(test_dataset, batch_size=64, shuffle=False, num_workers=0)
    
    # 2. Modeli Yükleme ve Eğitilmiş Ağırlıkları Enjekte Etme
    model = build_model(model_name=model_name).to(device)
    model_path = f"models/{model_name}_pcam_best.pth"
    
    if os.path.exists(model_path):
        model.load_state_dict(torch.load(model_path, map_location=device))
        print(f"Eğitilmiş model başarıyla yüklendi: {model_path}")
    else:
        print("HATA: Eğitilmiş model dosyası bulunamadı! Önce train.py dosyasını çalıştırmalısınız.")
        return
        
    # 3. Tahminleri Toplama
    model.eval()
    all_preds = []
    all_targets = []
    
    with torch.no_grad():
        for images, labels in test_loader:
            images = images.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)
            
            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(labels.numpy())
            
    # 4. Karışıklık Matrisini (Confusion Matrix) Hesaplama
    # Hazır kütüphane yerine tamamen yerel (çevrimdışı) kodlarla hesaplıyoruz
    tp, fp, fn, tn = 0, 0, 0, 0
    for p, t in zip(all_preds, all_targets):
        if p == 1 and t == 1: tp += 1
        elif p == 1 and t == 0: fp += 1
        elif p == 0 and t == 1: fn += 1
        elif p == 0 and t == 0: tn += 1
        
    accuracy = (tp + tn) / len(all_targets)
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    recall = tp / (tp + fn) if (tp + fn) > 0 else 0
    f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
    
    print("\n================ TEST SONUÇLARI ================")
    print(f"Test Doğruluğu (Accuracy): {accuracy*100:.2f}%")
    print(f"Keskinlik (Precision): {precision:.4f} (Kanser dediklerimizin yüzde kaçı gerçekten kanser?)")
    print(f"Duyarlılık (Recall): {recall:.4f} (Gerçek kanserlilerin yüzde kaçını yakalayabildik?)")
    print(f"F1-Score: {f1:.4f} (Dengeleyici Skor)")
    print("================================================")
    
    # 5. Sonuçları Grafik Olarak Görselleştirme (Confusion Matrix Çizimi)
    fig, ax = plt.subplots(figsize=(6, 6))
    matrix = [[tn, fp], [fn, tp]]
    
    ax.matshow(matrix, cmap=plt.cm.Blues, alpha=0.3)
    for i in range(2):
        for j in range(2):
            ax.text(x=j, y=i, s=matrix[i][j], va='center', ha='center', size='xx-large')
            
    plt.xlabel('Tahmin Edilen Sınıf', fontsize=12)
    plt.ylabel('Gerçek Sınıf', fontsize=12)
    plt.title('Karışıklık Matrisi (Confusion Matrix)', fontsize=14)
    ax.set_xticklabels(['', 'Sağlıklı (0)', 'Kanserli (1)'])
    ax.set_yticklabels(['', 'Sağlıklı (0)', 'Kanserli (1)'])
    
    plt.tight_layout()
    plt.show()
    
    test_dataset.close()

if __name__ == "__main__":
    evaluate_model(model_name="resnet18")