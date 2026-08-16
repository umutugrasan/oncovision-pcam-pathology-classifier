/**
 * Landing için animasyonlu DNA çift sarmalı.
 * Her baz çifti Y ekseninde döner; ardışık bazlar faz kaydırmalı olduğu için
 * klasik dönen helix görünümü oluşur. Uçlardaki parlayan boncuklar iki sarmal
 * omurgayı temsil eder. Tamamen CSS.
 */
const BASES = Array.from({ length: 34 });

export default function DnaViz() {
  return (
    <div className="dna-viz" aria-hidden>
      <div className="dna">
        {BASES.map((_, i) => (
          <div
            key={i}
            className="dna-base"
            style={{ animationDelay: `${(-i * 0.16).toFixed(2)}s` }}
          >
            <span className={`dna-node ${i % 2 ? "alt" : ""}`} />
            <span className={`dna-node right ${i % 2 ? "alt" : ""}`} />
          </div>
        ))}
      </div>
    </div>
  );
}
