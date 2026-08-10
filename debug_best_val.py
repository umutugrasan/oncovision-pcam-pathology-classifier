import torch
from train import build_model
from dataset import get_data_loaders

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print("Cihaz:" , device)

model_name = "resnet18"
model_path = f"models/{model_name}_pcam_best.pth"

model = build_model(model_name=model_name).to(device)
state = torch.load(model_path, map_location=device)
model.load_state_dict(state)
model.eval()

_, val_loader = get_data_loaders(data_dir = "data",batch_size=64)

criterion = torch.nn.CrossEntropyLoss()
val_loss = 0.0
val_corrects = 0
val_total = 0

with torch.no_grad():
    for images,labels in val_loader:
        images,labels = images.to(device), labels.to(device)
        outputs = model(images)
        loss = criterion(outputs,labels)

        val_loss += loss.item() * images.size(0)
        _, preds = torch.max(outputs,1)
        val_corrects += torch.sum(preds == labels.data)
        val_total += images.size(0)

epoch_val_loss = val_loss / val_total
epoch_val_acc = (val_corrects.double() / val_total)*100

print(f"model adı: {model_name}")
print(f"kaydedilen en iyi modelin Validation lossu: {epoch_val_loss: .4f}")
print(f"kaydedilen en iyi modelin Validation Acci: {epoch_val_acc: .4f}")