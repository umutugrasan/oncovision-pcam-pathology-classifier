import os
import copy
import torch
import torch.nn as nn
import torch.optim as optim
import matplotlib.pyplot as plt
from torchvision import models
from dataset import get_data_loaders

def build_model(model_name="resnet18"):
    """
    Transfer Learning yapısını kuran fonksiyon.
    İnternetimiz olmadığı için yerel diske indirilmiş ağırlıkları çağırır.
    """
    if model_name == "resnet18":
        # test_setup.py ile bilgisayara kaydettiğimiz yerel ağırlık dosyasını çağırıyoruz
        model = models.resnet18(weights=models.ResNet18_Weights.DEFAULT)
    elif model_name == "resnet50":
        model = models.resnet50(weights=models.ResNet50_Weights.DEFAULT)
    else:
        raise ValueError("Lütfen 'resnet18' veya 'resnet50' seçin.")


    # Önce modelin tüm parametrelerini donduruyoruz (Gradients = False)
    # Bu sayede ResNet'in ImageNet'ten öğrendiği kenar/doku/hücre benzeri özellikler sabit kalır.
    for param in model.parameters():
        param.requires_grad = False

    # SONRA sadece layer3 ve layer4'ün kilidini aç (Partial Fine-Tuning)
    for param in model.layer3.parameters():
        param.requires_grad = True
    for param in model.layer4.parameters():
        param.requires_grad = True
        
    # Modelin son karar katmanını (Fully Connected) bulup kendi binary (2 sınıf) yapımıza uyarlıyoruz.
    # Değiştirilen yeni katmanın 'requires_grad' değeri otomatik olarak True olur, yani sadece karar katmanı olan son katman eğitilir.
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, 2) 
    # ImageNet'in karar katmanı her görüntü için 1000 sınıflı bir çıktı üretiyor. Bizim problemimizde sadece 2 sınıf var (sağlıklı/kanserli).
    
    return model


def plot_history(history, model_name):
    """
    Eğitim boyunca toplanan train/val doğruluk ve kayıp değerlerini grafiğe döker.
    Grafik hem ekranda gösterilir hem de diske PNG olarak kaydedilir.
    """
    # Buradaki amaç: train ve validation çizgilerini yan yana görmek.
    # İkisi birlikte yükselip bir yerde validation ayrılıp düşmeye başlıyorsa, kırılım orasıdır.
    epochs_range = range(1, len(history["train_acc"]) + 1)

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

    # --- Doğruluk (Accuracy) grafiği ---
    ax1.plot(epochs_range, history["train_acc"], "o-", label="Train Acc")
    ax1.plot(epochs_range, history["val_acc"], "o-", label="Validation Acc")
    # En iyi val acc noktasını işaretle
    best_epoch = history["val_acc"].index(max(history["val_acc"])) + 1
    ax1.axvline(best_epoch, color="green", linestyle="--", alpha=0.7,
                label=f"En iyi (Epoch {best_epoch})")
    ax1.set_xlabel("Epoch")
    ax1.set_ylabel("Doğruluk (%)")
    ax1.set_title("Train vs Validation Doğruluğu")
    ax1.legend()
    ax1.grid(True, alpha=0.3)

    # --- Kayıp (Loss) grafiği ---
    ax2.plot(epochs_range, history["train_loss"], "o-", label="Train Loss")
    ax2.plot(epochs_range, history["val_loss"], "o-", label="Validation Loss")
    ax2.set_xlabel("Epoch")
    ax2.set_ylabel("Kayıp (Loss)")
    ax2.set_title("Train vs Validation Kaybı")
    ax2.legend()
    ax2.grid(True, alpha=0.3)

    plt.tight_layout()
    plot_path = f"{model_name}_egitim_grafigi.png"
    plt.savefig(plot_path, dpi=100)
    print(f"\n=> Eğitim grafiği kaydedildi: {plot_path}")
    plt.show()


def run_training(batch_size=32, patience=5, max_epochs=100, model_name="resnet18"):
    # patience   = En iyi val acc'den sonra kaç epoch iyileşme olmazsa duracağı (kırılım tespiti)
    # max_epochs = Güvenlik üst sınırı; normalde early stopping bundan çok önce durdurur

    # Cihaz belirleme
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Eğitim Cihazı: {device}")
    print(f"Kullanılan:  {model_name}")

    # Veriyi yükle
    train_loader, val_loader = get_data_loaders(data_dir="data", batch_size=batch_size)



    # Modeli oluştur ve ekran kartına taşı
    model = build_model(model_name=model_name).to(device)

    # Sınıflandırma için Standart CrossEntropy Kayıp Fonksiyonu
    criterion = nn.CrossEntropyLoss()

    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=0.0001)    # Şimdiye kadarki en iyi skoru ve o skordan beri kaç epoch geçtiğini takip ediyoruz.
    best_val_acc = 0.0
    epochs_no_improve = 0          # En iyi val acc'den beri kaç epoch iyileşme olmadığını sayar
    best_epoch = 0 
    best_model_wts = copy.deepcopy(model.state_dict())  # En iyi ağırlıkları bellekte tut

    # Tüm epoch'ların değerlerini grafik için topluyoruz
    history = {"train_loss": [], "train_acc": [], "val_loss": [], "val_acc": []}

    os.makedirs("models", exist_ok=True)
    best_model_path = f"models/{model_name}_pcam_best.pth"

    epoch = 0
    while epoch < max_epochs:
        epoch += 1
        print(f"\nEpoch {epoch}")
        print("-" * 20)

        # --- MODELİ EĞİTME (TRAIN) ---
        model.train()
        running_loss = 0.0
        corrects = 0
        total = 0

        for batch_idx ,(images, labels) in enumerate(train_loader):
            images, labels = images.to(device), labels.to(device)

            optimizer.zero_grad() # Gradyanları sıfırla

            outputs = model(images) # Tahmin üret (Forward Pass)
            loss = criterion(outputs, labels) # Hatayı hesapla

            loss.backward() # Hatayı geriye yay (Backpropagation)
            optimizer.step() # Ağırlıkları güncelle

            running_loss += loss.item() * images.size(0)
            _, preds = torch.max(outputs, 1)
            corrects += torch.sum(preds == labels.data)
            total += images.size(0)

            if batch_idx %10 ==0:
                print(f"[Train Batch {batch_idx}] Loss:{loss.item():.4f}")

        epoch_loss = running_loss / total
        epoch_acc = (corrects.double() / total).item() * 100
        print(f"Eğitim Kaybı: {epoch_loss:.4f} | Eğitim Doğruluğu (Acc): {epoch_acc:.2f}%")

        # --- MODELİ DOĞRULAMA (VALIDATION) ---
        model.eval()
        val_loss = 0.0
        val_corrects = 0
        val_total = 0

        with torch.no_grad(): # Validation yaparken ağırlıkları güncellemiyoruz, belleği koru
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                loss = criterion(outputs, labels)

                val_loss += loss.item() * images.size(0)
                _, preds = torch.max(outputs, 1)
                val_corrects += torch.sum(preds == labels.data)
                val_total += images.size(0)

        epoch_val_loss = val_loss / val_total
        epoch_val_acc = (val_corrects.double() / val_total).item() * 100
        print(f"Doğrulama Kaybı: {epoch_val_loss:.4f} | Doğrulama Doğruluğu (Acc): {epoch_val_acc:.2f}%")

        # Grafik için bu epoch'un değerlerini kaydet
        history["train_loss"].append(epoch_loss)
        history["train_acc"].append(epoch_acc)
        history["val_loss"].append(epoch_val_loss)
        history["val_acc"].append(epoch_val_acc)

        # --- EARLY STOPPING (Kırılım tespiti) ---
        # Mantık şu: model bir yere kadar öğrenir, val acc yükselir. Sonra tepe yapar ve düşmeye başlar.
        # Ben sabit sayı girmiyorum; en yüksek val acc'yi geçtiği sürece devam etsin.
        # Bu epoch bir öncekilerin en iyisini geçtiyse: en iyi model bu, kaydet ve sayacı sıfırla.
        if epoch_val_acc > best_val_acc:
            best_val_acc = epoch_val_acc
            best_epoch = epoch
            epochs_no_improve = 0
            best_model_wts = copy.deepcopy(model.state_dict())
            torch.save(best_model_wts, best_model_path)
            print(f"=> Yeni en iyi model kaydedildi! (Val Acc: {best_val_acc:.2f}%)")
        else:
            # Bu sefer tepeyi geçemedik. Kaç kere üst üste geçemediğimizi sayıyoruz.
            epochs_no_improve += 1
            print(f"=> İyileşme yok ({epochs_no_improve}/{patience}). "
                  f"En iyi: Epoch {best_epoch} -> {best_val_acc:.2f}%")

            # 5 kere üst üste tepeyi geçemediysek artık boşuna; kırılım olmuş, eğitimi bitir.
            # (En iyi model zaten yukarıda kaydedildi, elimizde duruyor.)
            if epochs_no_improve >= patience:
                print(f"\n!! Kırılım tespit edildi: {patience} epoch boyunca iyileşme olmadı. "
                      f"Eğitim durduruluyor.")
                break

    # Dosyaları kapatıyoruz
    train_loader.dataset.close()
    val_loader.dataset.close()

    print("\nEğitim Tamamlandı!")
    print(f"En iyi Doğrulama Doğruluğu: {best_val_acc:.2f}% (Epoch {best_epoch})")
    print(f"En iyi model: {best_model_path}")

    # Tüm iterasyonların train/val değerlerini grafiğe dök ve sun
    plot_history(history, model_name)

    return history

if __name__ == "__main__":

    run_training(batch_size=32, patience=5, model_name="resnet18")

    # patience = en iyi val acc'den sonra kaç epoch iyileşme olmazsa duracağı (kırılım/overfitting tespiti).
    # batch_size = her iterasyonda belleğe kaç görüntü verileceği. Hepsini tek seferde veremezsin. Bellek patlar.
    # Her seferde verilen her bir pakete mini batch denir.



optimizer = optim.SGD(filter(lambda p: p.requires_grad, model.parameters()), lr=0.0001, momentum=0.9, weight_decay=1e-4)


