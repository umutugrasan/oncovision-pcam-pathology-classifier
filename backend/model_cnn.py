"""
PCam icin SIFIRDAN CNN (96x96, ikili siniflandirma).
PathMNIST'teki CNN'in ayni mantigi; sadece 96x96 girise ve 2 sinifa uyarlandi:
her blok iki Conv(+BN+ReLU) + MaxPool ile 96->48->24->12->6 kuculur, sonda
GlobalAvgPool ile FC girisi sabitlenir (girdi boyutundan bagimsiz, saglam).
"""
import torch.nn as nn


def _block(cin, cout):
    return nn.Sequential(
        nn.Conv2d(cin, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
        nn.Conv2d(cout, cout, 3, padding=1), nn.BatchNorm2d(cout), nn.ReLU(inplace=True),
        nn.MaxPool2d(2),
    )


class PcamCNN(nn.Module):
    def __init__(self, hidden=32, n_classes=2, p_drop=0.4):
        super().__init__()
        self.features = nn.Sequential(
            _block(3, hidden),          # 96 -> 48
            _block(hidden, hidden * 2), # 48 -> 24
            _block(hidden * 2, hidden * 4),  # 24 -> 12
            _block(hidden * 4, hidden * 8),  # 12 -> 6
        )
        self.head = nn.Sequential(
            nn.AdaptiveAvgPool2d(1),
            nn.Flatten(),
            nn.Dropout(p_drop),
            nn.Linear(hidden * 8, n_classes),
        )

    def forward(self, x):
        return self.head(self.features(x))
