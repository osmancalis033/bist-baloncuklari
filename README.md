# BIST Baloncukları — Lokal Sunum Sürümü

Bu paket, GitHub Pages'te yayımlanan mobil ve fonlar modüllü sürümün lokal çalışma kopyasıdır.

## Windows'ta çalıştırma

1. ZIP dosyasını bir klasöre çıkarın.
2. `BIST_Baloncuklarini_Baslat.bat` dosyasına çift tıklayın.
3. Tarayıcı otomatik açılır.
4. Sunum sırasında `F11` ile tam ekran kullanabilirsiniz.
5. Uygulamayı kapatmak için siyah komut penceresinde `Ctrl+C` tuşlarına basın.

Python dışında ek paket kurulumu gerekmez.

## macOS / Linux

Terminalde klasöre girip şunu çalıştırın:

```bash
./start_mac_linux.sh
```

## Güncelleme çalışma düzeni

Lokal geliştirmelerde çoğunlukla şu dosyalar değişir:

- `index.html`
- `app.js`
- `styles.css`
- `demo-data.js`

Değişiklikleri lokal sunucuda kontrol ettikten sonra `GitHub_Paketi_Olustur.bat` dosyasına çift tıklayın. Oluşan `GitHub_Yukleme_Paketi_*.zip` arşivini açıp içindeki dosyaları GitHub repository'sine yükleyin.

GitHub'da:

```text
Add file → Upload files → Commit changes
```

## Veri durumu

Bu sürüm yatırımcı sunumu ve ürün doğrulama amacıyla statik/prototip veri kullanır. Canlı veya gecikmeli veri sağlayıcısı bağlandığında yalnızca veri katmanı güncellenecek; mevcut arayüz korunabilir.

## Saatlik Sunum Simülasyonu

Bu lokal sürümde fiyatlar rastgele her yenilemede değişmez. Veriler hisse, sektör, gün ve saat bazında deterministik üretilir:

- Aynı saat içinde sayfayı yenilerseniz aynı fiyatlar görünür.
- Saat değiştiğinde fiyatlar küçük ve kümülatif adımlarla ilerler.
- Piyasa, sektör ve hisse özelindeki hareket bileşenleri birlikte kullanılır.
- Günlük fiyat hareketi aşırı sıçramaları önlemek için sınırlandırılmıştır.
- FROTO referans fiyatı sunum için 86 TL olarak güncellenmiştir.
- Yeni referans fiyat eklemek için `demo-data.js` dosyasındaki `BIST_PRESENTATION_OVERRIDES` alanını kullanabilirsiniz.

Bu veriler gerçek piyasa verisi değildir. Arayüzde kaynak `Sunum Simülasyonu · Saatlik görünüm` olarak belirtilir.


## Lite / Pro Görünümü

- Uygulama varsayılan olarak **Lite** görünümde açılır.
- Lite: baloncuklar, temel filtreler, sade piyasa özeti, fiyat/hacim grafiği, kurum hedef özeti, fon sahipliği ve öne çıkan gelişmeler.
- Pro: Tarayıcı, Portföy, Karşılaştırma, teknik/temel analiz, pivotlar, kurum konsensüsü, fon detayları ve gelişmiş metrikler.
- Üst bölümdeki **Lite / Pro** anahtarıyla anlık geçiş yapılır; seçim tarayıcıda saklanır.


## Lite / Pro v5

Ürün modu seçimi artık üst menüde BIST logosunun hemen yanında bulunan **Deneyim · Lite / Pro** anahtarıyla yapılır. Anahtar doğrudan çalışan butonlarla bağlanmıştır. Lite sürüm müşteri kazanımına yönelik sade deneyimdir; Pro sürüm mevcut gelişmiş ekranların tamamını korur.


## Sembol Güncellemesi (v6)

Borsa İstanbul işlem kodu değişiklikleri uygulamaya işlendi:

- KOZAA → **TRMET** (TR Anadolu Metal Madencilik)
- KOZAL → **TRALT** (Türk Altın İşletmeleri)
- IPEKE → **TRENJ** (TR Doğal Enerji)

Eski `market_cache.json` dosyası bulunursa bu üç sembol otomatik olarak yeni kodlara taşınır.


## v7 Güncellemesi

- Pro görünümde üst dönem filtrelerine **15Dk** eklendi.
- Hisse detay grafiğinde **15Dk** periyodu eklendi.
- Sağdaki **Sektör Gücü / Favoriler / Alarmlar** kolonu masaüstünde artık **sticky** çalışır; tüm sayfa boyunca boş uzamak yerine görünür alanda sabit kalır.
- Sağ kolon kartlarına yumuşak scrollbar ve alt fade efekti eklendi.


## UX v8

- **Baloncuk hızlı aksiyon menüsü:** masaüstünde sağ tık, mobilde uzun bas. Detay, favori, karşılaştırma, alarm, paylaşım kartı ve TradingView erişimi.
- **Paylaşılabilir hisse kartı:** detay ekranındaki Paylaş butonu veya hızlı aksiyon menüsü üzerinden PNG kart oluşturur; destekleyen mobil cihazlarda sistem paylaşım menüsünü açar.
- **Bugün Piyasada Ne Oluyor?:** piyasa yönü, sektör lider/zayıf, hacim ivmesi, genişlik ve öne çıkan sinyalleri tek paragrafta özetler.


## GitHub Pages sürümü

Bu paket backend gerektirmez. Fiyatlar ve piyasa özeti sunum simülasyonu ile üretilir ve arayüzde kaynak etiketi buna göre gösterilir. Lokal TradingView gecikmeli paket gerçek/gecikmeli veri sunumu için kullanılmalıdır.
