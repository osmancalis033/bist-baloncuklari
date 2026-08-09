# BIST Baloncukları · Lite / Pro

Bu sürüm tek uygulama içinde iki ayrı kullanıcı deneyimi sunar.

## Lite
- Varsayılan açılış görünümüdür.
- Baloncuk haritası, temel dönem/sektör/hızlı filtreler ve sade piyasa özeti gösterilir.
- Hisse detayında fiyat-hacim grafiği, günlük aralık, kurum hedef özeti, fon sahipliği, öne çıkan 3 fon ve gelişme özeti yer alır.
- “Detaylı analize geç → PRO” ile aynı hisse üzerinde Pro görünüm açılır.

## Pro
- Tarayıcı, Portföy, Karşılaştırma ve sağ bilgi rayı açılır.
- Gelişmiş baloncuk metrikleri, timeline, teknik/temel analiz, pivotlar, kurum konsensüsü, fon detayları ve AI özeti görünür.

## Mod hafızası
Kullanıcının son Lite / Pro tercihi tarayıcı LocalStorage alanında saklanır.

## Veri
Piyasa fiyat katmanı mevcut TradingView/borsapy gecikmeli veri servisini kullanır. Bağlantı geçici olarak koparsa son başarılı gerçek snapshot korunur; demo fiyata geri dönülmez.

## Üst Menü Güncellemesi

Lite / Pro geçişi sağ üst aksiyon alanına taşındı. Yenile ve tema butonlarıyla aynı grupta, tema ikonunun hemen yanında **Lite Sürüm | Pro Sürüm** olarak sürekli görünür. Mobilde alan kazanmak için etiketler **Lite | Pro** olarak kısalır.


### v5 kontrolü
- Üst solda **Deneyim | Lite | Pro** anahtarı her zaman görünür.
- Lite: Piyasa + sade filtreler + 4 temel özet + baloncuklar + sade hisse detayı.
- Pro: Tarayıcı, Portföy, Karşılaştır, gelişmiş filtreler ve tüm analiz sekmeleri.
- Seçim `localStorage` içinde saklanır.
