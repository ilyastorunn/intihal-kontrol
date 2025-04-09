const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const stringSimilarity = require('string-similarity');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

app.post('/kontrol', (req, res) => {
    const { tez, kaynaklar, esik } = req.body;
  
    // Veriyi kullan, ama hiçbir zaman kaydetme
    const tezCumleleri = tez.split('.').map(c => c.trim()).filter(Boolean);
    const kaynakCumleleri = kaynaklar.split('.').map(c => c.trim()).filter(Boolean);
    const oranEsigi = (esik || 80) / 100;
  
    const supheliler = tezCumleleri.reduce((acc, cumle) => {
      const eslesen = kaynakCumleleri.find(k => {
        const oran = stringSimilarity.compareTwoStrings(cumle, k);
        return oran >= oranEsigi;
      });
      if (eslesen) {
        acc.push({
          cumle,
          kaynak: eslesen,
          oran: Math.round(stringSimilarity.compareTwoStrings(cumle, eslesen) * 10000) / 100
        });
      }
      return acc;
    }, []);
  
    res.json({ sonuc: supheliler });
  
    // ❌ Tez veya kaynaklar hiçbir yerde kaydedilmez
  });

app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});