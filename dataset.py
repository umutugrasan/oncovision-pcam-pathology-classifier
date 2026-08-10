#BU KISIMDA VERİYİ OKUYUP İŞLEYEREK MODELE VERMEYE HAZIR HALE GETİRİYORUZ.

import os
import h5py
import torch
from torch.utils.data import Dataset, DataLoader
from torchvision import transforms
from PIL import Image

class PatchCamelyonDataset(Dataset):  
# HDF5 dosyalarından verileri index bazlı okuyan özel PyTorch Dataset sınıfı.

    def __init__(self, x_path, y_path, transform=None):
     
        self.x_path = x_path #Görüntü verilerinin bulunduğu h5 dosysının yolu.
        self.y_path = y_path #Etiketlerin (kanserli/sağlıklı) bulunduğu yol.
        self.transform = transform #Görselleri modele vermeden önce üzerlerinde yapacağımız normalizasyon,yeniden boyutlandırma,döndürme gibi işlemleri tanımlayan dönüştürücü.
        
        # Dosyaları okuma modunda açıyoruz
        self.x_file = h5py.File(self.x_path, 'r')
        self.y_file = h5py.File(self.y_path, 'r')
        

        # H5 içindeki dataset anahtarlarına erişim sağlıyoruz
        
        self.images = self.x_file['x'] #x içinde görüntüler(images) bulunur.
        # Örneğin img0 = self.images[0],
                 #img10 = self.images[10] şeklinde indekslenir.
        
        self.labels = self.y_file['y'] #y içinde etiketler bulunur.
        # Aynı şekilde label0 = self.label[0],
                      #label10 = self.label[10] gibi indekslenir.
        
        self.length = self.images.shape[0] # Toplam veri sayısı

    def __len__(self):
        return self.length 
    # böylece len(train_dataset) dendiğinde pytorch self.length değerini alıyor.
    # örneğin len(train_dataset) = 262144 gibi.


    def __getitem__(self, idx):
        # h5 dosyasından ilgili indexteki resmi ve etiketi çekiyoruz
        img = self.images[idx] # (96, 96, 3) boyutunda numpy array
        label = self.labels[idx] # Etiket matrisi
        
        # Etiketi skaler bir tamsayıya (0 veya 1) indirgiyoruz
        label = int(label.item()) if hasattr(label, 'item') else int(label[0][0][0])
        
        # Şuan Numpy array türünde olan img'i PIL Image formatına çeviriyoruz (Transformasyonlar için bu format gerekiyor)
        img = transforms.ToPILImage()(img)

        if self.transform:
            img = self.transform(img)
            
        return img, label

    def close(self):
        """Dosyaları güvenli bir şekilde kapatmak için kullanılır."""
        self.x_file.close()
        self.y_file.close()

# =====================================================================
# VERİ ÖN İŞLEME VE AUGMENTATION (VERİ ARTIRMA) MÜHENDİSLİĞİ
# =====================================================================
# Neden Augmentation yapıyoruz? Modelin kanserli hücreyi sadece düz dururken değil, 
# dönmüş veya ters çevrilmiş haldeyken de tanıması için veriyi çeşitlendiriyoruz.

train_transforms = transforms.Compose([ #içine verdiğin şeyleri sırayla yapan bi pipeline oluşturur.
    transforms.Resize((224, 224)),              # ResNet standart girdi boyutuna çevir
    transforms.RandomHorizontalFlip(p=0.5),     # %50 ihtimalle yatay çevir. Buna augmentation denir. Hücrenin sağa ya da sola bakıyor olmasından modelin etkilenmemesini sağlar.
    transforms.RandomVerticalFlip(p=0.5),       # %50 ihtimalle dikey çevir. Aynı şey dikey eksen için de geçerli.
    transforms.RandomRotation(degrees=15),      #+ - 15 derece döndürür.
    transforms.ToTensor(),                      # [0, 255] piksel değerlerini (PIL image) --> [0.0, 1.0] arasına sıkıştırır (Tensor)
    transforms.Normalize(mean=[0.485, 0.456, 0.406], 
                         std=[0.229, 0.224, 0.225]) # ImageNet veri seti ortalamaları ile normalizasyon:
                         # Normalize her kanal için (RGB renk kanalları) şu işlemi yapıyor : 
                         # R_norm = (R-0.485)/0.229
                         # G_norm = (G-0.456)/0.224
                         # B_norm = (B-0.406)/0.225

                         # Bu sayılar ImageNet'in kabul ettiği standart sayılar ve klasik normalizasyon.
]) 

# Doğrulama ve test verisinde veri artırma YAPILMAZ. Sadece boyutlandırma ve normalizasyon yapılır.Çünkü doğrulama ve testte modelin gerçek performansını ölçmek isteriz.Resmi rastgele çevirip bozmak istemeyiz.
val_transforms = transforms.Compose([ 
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

def get_data_loaders(data_dir, batch_size=64):
    """
    Eğitim ve Doğrulama veri yükleyicilerini (DataLoader) hazırlayan fonksiyon.
    """
    train_x = os.path.join(data_dir, "camelyonpatch_level_2_split_train_x.h5") #eğitim görüntülerinin olduğu dosyanın tam yolunu oluşturmayı sağlar.
    train_y = os.path.join(data_dir, "camelyonpatch_level_2_split_train_y.h5") #eğitim etiketlerinin olduğu dosyanın tam yolunu oluşturmayı sağlar.
    val_x = os.path.join(data_dir, "camelyonpatch_level_2_split_valid_x.h5") #validation görüntüleri
    val_y = os.path.join(data_dir, "camelyonpatch_level_2_split_valid_y.h5") #validation etiketleri
    
    train_dataset = PatchCamelyonDataset(train_x, train_y, transform=train_transforms) 
    #train_dataset[i] dediğin zaman i.resmi çeker, etiketini çeker ve train_transform uygular.
    val_dataset = PatchCamelyonDataset(val_x, val_y, transform=val_transforms)
    #aynı şekilde val_dataset[i] dediğin zaman i.resmi çeker, etiketini çeker ve val_transform uygular.
    
    # DataLoader: Verileri RAM'i yormadan batch_size'lık paketler halinde işlemci/GPU'ya taşır.
    # num_workers=0 Windows işletim sisteminde kilitlenmeleri ve çoklu işlemci (multiprocessing) hatalarını önler.
    train_loader = DataLoader(train_dataset, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_dataset, batch_size=batch_size, shuffle=False, num_workers=0)
    
    #batch_size'ı eğitim yaparken biz belirliyoruz standardı batch_size=64tür ama gpu bellğine göre 16/32/64 gibi değiştirebilirsin.
    
    return train_loader, val_loader