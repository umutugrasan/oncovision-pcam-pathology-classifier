export default function Hakkinda() {
  return (
    <div className="page">
      <header className="header">
        <h1>Hakkında</h1>
        <p className="subtitle">Model, veri seti ve performans bilgisi</p>
      </header>

      <main className="card prose">
        <h2>Model ne yapıyor?</h2>
        <p>
          Bu araç, <b>PatchCamelyon (PCam)</b> veri seti üzerinde{" "}
          <b>transfer learning + fine-tuning</b> ile eğitilmiş bir{" "}
          <b>ResNet18</b> modelini kullanır. PCam, Camelyon16 veri setinden
          türetilmiştir; görüntüler meme kanseri hastalarının <b>lenf düğümü</b>{" "}
          kesitleridir (H&amp;E boyalı). Model, bir patch'in merkez dokusunda{" "}
          <b>metastatik meme kanseri</b> olup olmadığını sınıflandırır.
        </p>

        <h2>Teknik detay</h2>
        <ul>
          <li>Girdi: 96×96 RGB patch → Resize(224) → ImageNet normalizasyonu</li>
          <li>Çıktı: 2 sınıflı softmax (0 = Sağlıklı, 1 = Kanserli)</li>
          <li>Fine-tuning: layer3 + layer4 açık, Adam (lr=1e-4)</li>
        </ul>

        <h2>Performans (ResNet18, final)</h2>
        <table className="metrics">
          <tbody>
            <tr><td>Test Doğruluğu</td><td>%87.15</td></tr>
            <tr><td>Precision</td><td>0.9495</td></tr>
            <tr><td>Recall</td><td>0.7846</td></tr>
            <tr><td>F1-Score</td><td>0.8592</td></tr>
          </tbody>
        </table>

        <div className="warn-box">
          <strong>⚠️ Kısıt:</strong> Recall ~0.78 olduğundan model, gerçek
          kanserli vakaların yaklaşık <b>%22'sini kaçırabilir</b>. Bu nedenle
          araç <b>klinik tanı için uygun değildir</b> ve yalnızca araştırma /
          eğitim amaçlıdır.
        </div>
      </main>
    </div>
  );
}
