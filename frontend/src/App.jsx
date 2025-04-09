import { useState } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as use from '@tensorflow-models/universal-sentence-encoder';
import * as tf from '@tensorflow/tfjs';

function App() {
  const [tez, setTez] = useState('');
  const [kaynaklar, setKaynaklar] = useState('');
  const [sonuc, setSonuc] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [esik, setEsik] = useState(80);
  const [genelOran, setGenelOran] = useState(null);

  const yukleParafrazOrnekleri = () => {
    const ornekTez = `
    Yapay zekâ tıp alanında kullanılmaktadır.
    Bu sistem oldukça verimli çalışmaktadır.
    Öğrenciler derse düzenli katılım göstermelidir.
    Teknolojinin ilerlemesi insan hayatını kolaylaştırmaktadır.
    Küresel ısınma çevreyi tehdit etmektedir.
    `;

    const ornekKaynaklar = `
    Tıpta yapay zekâ uygulamaları giderek yaygınlaşıyor.
    Sistem yüksek performansla çalışmaktadır.
    Derslere sürekli devam etmek öğrenciler için önemlidir.
    Teknolojik gelişmeler yaşamı daha kolay hâle getirmiştir.
    İklim değişikliği doğayı tehdit eden bir unsurdur.
    `;

    setTez(ornekTez.trim());
    setKaynaklar(ornekKaynaklar.trim());
  };

  const handleTxtUpload = async (e, target) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      if (target === 'tez') {
        setTez(text);
      } else {
        setKaynaklar(text);
      }
    };
    reader.readAsText(file);
  };

  const kontrolEt = async () => {
    setLoading(true);
    setError(null);
    setSonuc([]);
    try {
      const res = await fetch('http://localhost:3001/kontrol', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tez, kaynaklar, esik }),
      });

      if (!res.ok) {
        throw new Error('Sunucu hatası.');
      }

      const data = await res.json();
      setSonuc(data.sonuc);

      if (data.sonuc.length > 0) {
        const toplam = data.sonuc.reduce((acc, item) => acc + item.oran, 0);
        const ortalama = toplam / data.sonuc.length;
        setGenelOran(Math.round(ortalama * 100) / 100);
      } else {
        setGenelOran(null);
      }
    } catch (err) {
      setError('Bir hata oluştu. Lütfen tekrar deneyin.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const semanticKontrolEt = async () => {
    setLoading(true);
    setError(null);
    setSonuc([]);

    try {
      const model = await use.load();
      const tezCumleleri = tez.split('.').map(c => c.trim()).filter(Boolean);
      const kaynakCumleleri = kaynaklar.split('.').map(c => c.trim()).filter(Boolean);

      const tezEmbeddings = await model.embed(tezCumleleri);
      const kaynakEmbeddings = await model.embed(kaynakCumleleri);

      const supheliler = [];

      for (let i = 0; i < tezCumleleri.length; i++) {
        let maxSim = 0;
        let enBenzerKaynak = null;

        for (let j = 0; j < kaynakCumleleri.length; j++) {
          const sim = tf.losses.cosineDistance(
            tezEmbeddings.slice([i, 0], [1]),
            kaynakEmbeddings.slice([j, 0], [1]),
            1
          ).dataSync()[0];

          const benzerlik = 1 - sim;

          if (benzerlik >= esik / 100 && benzerlik > maxSim) {
            maxSim = benzerlik;
            enBenzerKaynak = kaynakCumleleri[j];
          }
        }

        if (enBenzerKaynak) {
          supheliler.push({
            cumle: tezCumleleri[i],
            kaynak: enBenzerKaynak,
            oran: Math.round(maxSim * 10000) / 100,
          });
        }
      }

      setSonuc(supheliler);
    } catch (err) {
      setError('Semantic kontrol sırasında hata oluştu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const indirSonuc = () => {
    const blob = new Blob([JSON.stringify(sonuc, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'intihal_sonucu.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const indirPDF = async () => {
    const element = document.getElementById('sonuc-alani');
    if (!element) return;

    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL('image/png');

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgProps = pdf.getImageProperties(imgData);
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save('intihal_sonucu.pdf');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start p-8 space-y-6">
      <h1 className="text-3xl font-bold">İntihal Kontrol</h1>

      <div className="w-full max-w-2xl mb-2">
        <label className="block mb-1 font-medium">Tez .txt dosyası yükle:</label>
        <input
          type="file"
          accept=".txt"
          onChange={(e) => handleTxtUpload(e, 'tez')}
        />
      </div>
      <textarea
        className="w-full max-w-2xl h-40 p-4 border border-gray-300 rounded"
        placeholder="Tez metnini buraya yapıştır..."
        value={tez}
        onChange={(e) => setTez(e.target.value)}
      />

      <div className="w-full max-w-2xl mb-2">
        <label className="block mb-1 font-medium">Kaynaklar .txt dosyası yükle:</label>
        <input
          type="file"
          accept=".txt"
          onChange={(e) => handleTxtUpload(e, 'kaynaklar')}
        />
      </div>
      <textarea
        className="w-full max-w-2xl h-40 p-4 border border-gray-300 rounded"
        placeholder="Kullanılan kaynakları buraya yapıştır..."
        value={kaynaklar}
        onChange={(e) => setKaynaklar(e.target.value)}
      />

      <button
        className="px-6 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
        onClick={yukleParafrazOrnekleri}
      >
        Parafrazlı Örnekleri Yükle
      </button>

      <div className="w-full max-w-2xl flex items-center gap-4">
        <label className="font-medium">Benzerlik Eşiği (%):</label>
        <input
          type="number"
          min="0"
          max="100"
          className="w-20 p-2 border border-gray-300 rounded"
          value={esik}
          onChange={(e) => setEsik(Number(e.target.value))}
        />
      </div>

      <button
        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        onClick={kontrolEt}
      >
        Kontrol Et
      </button>
      <button
        className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
        onClick={semanticKontrolEt}
      >
        Semantic Kontrol Et
      </button>

      {loading && <p className="text-blue-500">Kontrol ediliyor...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {sonuc.length > 0 && (
        <div id="sonuc-alani" className="w-full max-w-2xl mt-6 space-y-4">
          <h2 className="text-xl font-semibold">Şüpheli Cümleler</h2>
          {genelOran !== null && (
            <p className="text-lg font-medium text-gray-700">
              Genel Benzerlik Oranı: <span className="font-bold">{genelOran}%</span>
            </p>
          )}
          {sonuc.map((item, index) => (
            <div key={index} className="bg-white p-4 shadow rounded">
              <p><strong>Cümle:</strong> {item.cumle}</p>
              <p><strong>Benzer Kaynak:</strong> {item.kaynak}</p>
              <p><strong>Benzerlik:</strong> %{item.oran}</p>
            </div>
          ))}
          <button
            className="mt-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            onClick={indirSonuc}
          >
            Sonuçları İndir (.json)
          </button>
          <button
            className="mt-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            onClick={indirPDF}
          >
            Sonuçları İndir (.pdf)
          </button>
        </div>
      )}
    </div>
  );
}

export default App;