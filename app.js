(() => {
  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const STORAGE = {
    favorites: 'bist-pro-favorites',
    compare: 'bist-pro-compare',
    alerts: 'bist-pro-alerts',
    portfolio: 'bist-pro-portfolio',
    theme: 'bist-theme',
  };

  const TIMELINE_STEPS = [
    { label: 'Açılış', time: '10:00', progress: 0.00 },
    { label: 'İlk Saat', time: '11:00', progress: 0.14 },
    { label: 'Öğle Öncesi', time: '12:00', progress: 0.28 },
    { label: 'Öğle', time: '13:00', progress: 0.42 },
    { label: 'Öğle Sonrası', time: '14:00', progress: 0.58 },
    { label: 'İkinci Seans', time: '15:30', progress: 0.74 },
    { label: 'Kapanışa Doğru', time: '17:00', progress: 0.88 },
    { label: 'Kapanış', time: '18:00', progress: 1.00 },
  ];

  const DEFAULT_PORTFOLIO = [
    { symbol: 'THYAO', qty: 120, cost: 286.4 },
    { symbol: 'SAHOL', qty: 300, cost: 92.4 },
    { symbol: 'ASELS', qty: 180, cost: 79.7 },
    { symbol: 'AKBNK', qty: 450, cost: 61.5 },
    { symbol: 'BIMAS', qty: 48, cost: 495.0 },
    { symbol: 'TCELL', qty: 130, cost: 96.4 },
  ];

  const SCAN_GROUPS = [
    {
      title: 'Temel Analiz Taramaları',
      items: [
        { id: 'value', label: 'Düşük F/K', test: (s) => s.fundamental.pe < 10 && s.fundamental.pb < 2.2, reason: (s) => `F/K ${s.fundamental.pe.toFixed(1)} · PD/DD ${s.fundamental.pb.toFixed(2)}` },
        { id: 'dividend', label: 'Temettü Hisseleri', test: (s) => s.fundamental.dividendYield > 4.2, reason: (s) => `Temettü verimi ${formatPctValue(s.fundamental.dividendYield)}` },
        { id: 'growth', label: 'Büyüme Şirketleri', test: (s) => s.fundamental.salesGrowth > 16 && s.fundamental.profitGrowth > 18, reason: (s) => `Satış ${formatPctValue(s.fundamental.salesGrowth)} · Net Kâr ${formatPctValue(s.fundamental.profitGrowth)}` },
        { id: 'lowDebt', label: 'Borcu Düşük', test: (s) => s.fundamental.debtEbitda < 1.2, reason: (s) => `Net Borç/FAVÖK ${s.fundamental.debtEbitda.toFixed(2)}` },
      ],
    },
    {
      title: 'Teknik Taramalar',
      items: [
        { id: 'oversold', label: 'RSI 35 Altı', test: (s) => s.technical.rsi < 35, reason: (s) => `RSI ${s.technical.rsi.toFixed(1)} ile aşırı satım bölgesinde` },
        { id: 'trend', label: 'Trend Pozitif', test: (s) => s.technical.trendScore >= 2 && changeFor(s) > 0, reason: (s) => `${s.technical.buySignals} AL · ${s.technical.sellSignals} SAT sinyali` },
        { id: 'breakout', label: 'Zirve Kırılımı', test: (s) => priceFor(s) >= s.yearHigh * 0.97 || priceFor(s) > s.technical.bollUpper, reason: (s) => `Fiyat zirve bandına yakın · 52H ${formatPrice(s.yearHigh)}` },
        { id: 'volumeSpike', label: 'Hacim Patlaması', test: (s) => s.relVolume > 1.55, reason: (s) => `Göreceli hacim ${s.relVolume.toFixed(2)}x` },
      ],
    },
    {
      title: 'Piyasa Tarayıcıları',
      items: [
        { id: 'outperformer', label: 'Endeksten Pozitif Ayrışan', test: (s) => relativePerformanceFor(s) > 1.6, reason: (s) => `BIST'e göre ${formatPercent(relativePerformanceFor(s))}` },
        { id: 'newHigh', label: 'Yeni Zirve', test: (s) => priceFor(s) >= s.yearHigh * 0.97, reason: (s) => `52H zirvesine çok yakın` },
        { id: 'tavan', label: 'Tavan Adayları', test: (s) => changeFor(s) >= 8 || s.flags.tavan, reason: (s) => `Günlük değişim ${formatPercent(changeFor(s))}` },
        { id: 'deepDip', label: 'Dipten Tepki', test: (s) => s.pricePosition < 20 && changeFor(s) > 1.2, reason: (s) => `52H bandın alt bölgesinden tepki` },
      ],
    },
  ];

  function readSet(key) {
    try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); }
    catch { return new Set(); }
  }

  function saveSet(key, set) { try { localStorage.setItem(key, JSON.stringify([...set])); } catch {} }
  function readJson(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value ?? fallback;
    } catch {
      return fallback;
    }
  }
  function saveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }

  const state = {
    dpr: Math.min(2, window.devicePixelRatio || 1),
    width: 0,
    height: 0,
    nodes: [],
    rawStocks: [],
    filtered: [],
    period: '1g',
    query: '',
    sector: 'all',
    limit: 100,
    sizeMetric: 'marketCap',
    bubbleInfo: 'price',
    quickFilter: 'all',
    clusterMode: true,
    view: 'bubble',
    sortDescending: true,
    selected: null,
    hovered: null,
    dragging: null,
    dragOffsetX: 0,
    dragOffsetY: 0,
    dragStartX: 0,
    dragStartY: 0,
    animationId: 0,
    favorites: readSet(STORAGE.favorites),
    compare: readSet(STORAGE.compare),
    alerts: readJson(STORAGE.alerts, []),
    portfolio: readJson(STORAGE.portfolio, DEFAULT_PORTFOLIO),
    activeScreen: 'market',
    activeScan: 'value',
    timelineIndex: 7,
    playing: false,
    playTimer: 0,
    sourceLabel: 'Demo veri',
    updatedAt: new Date().toISOString(),
    sourceMode: 'demo',
    marketSummary: { marketChange: 0 },
    drawerChartPeriod: '1a',
    targetCache: new Map(),
  };

  const canvas = $('#bubbleCanvas');
  const ctx = canvas.getContext('2d');
  const miniChart = $('#miniChart');
  const miniCtx = miniChart.getContext('2d');
  const volumeChart = $('#volumeChart');
  const volumeCtx = volumeChart.getContext('2d');
  const tooltip = $('#tooltip');
  const loadingState = $('#loadingState');
  const emptyState = $('#emptyState');

  const trNumber = new Intl.NumberFormat('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const trCompact = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });
  const trDate = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'medium' });

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
  function average(values) { return values.reduce((sum, value) => sum + value, 0) / (values.length || 1); }
  function compact(value) { return trCompact.format(value); }
  function formatPrice(value) { return `${trNumber.format(value)} ₺`; }
  function capAbs(value, max) { return Math.max(-max, Math.min(max, value)); }
  function isMobileCanvas() { return state.width > 0 && state.width <= 700; }
  function formatPercent(value) { return `${value >= 0 ? '+' : ''}${trNumber.format(value)}%`; }
  function formatPctValue(value) { return `${trNumber.format(value)}%`; }
  function localSeed(text) {
    let hash = 2166136261;
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }
  function localRandom(seed) {
    let value = seed >>> 0;
    return () => {
      value = (Math.imul(value, 1664525) + 1013904223) >>> 0;
      return value / 4294967296;
    };
  }

  function currentPoint(stock) {
    return stock.timeline[Math.min(state.timelineIndex, stock.timeline.length - 1)] || stock.timeline[stock.timeline.length - 1];
  }
  function priceFor(stock) { return currentPoint(stock).price; }
  function changeFor(stock) { return currentPoint(stock).change; }
  function changeAmountFor(stock) { return currentPoint(stock).changeAmount; }
  function volumeFor(stock) { return currentPoint(stock).volume; }
  function relativePerformanceFor(stock) { return changeFor(stock) - (state.marketSummary.marketChange || 0); }

  function fitText(text, maxWidth, startSize, minSize, weight = 700) {
    for (let size = startSize; size >= minSize; size -= .5) {
      ctx.font = `${weight} ${size}px Manrope, Inter, sans-serif`;
      if (ctx.measureText(text).width <= maxWidth) return size;
    }
    return minSize;
  }

  function bubbleInfoText(stock) {
    switch (state.bubbleInfo) {
      case 'price': return formatPrice(priceFor(stock));
      case 'change': return formatPercent(changeFor(stock));
      case 'volume': return `Hacim ${compact(volumeFor(stock))}`;
      case 'relVolume': return `RVol ${stock.relVolume.toFixed(2)}x`;
      case 'volatility': return `Vol ${formatPctValue(stock.volatility)}`;
      case 'relative': return `Rel ${formatPercent(relativePerformanceFor(stock))}`;
      case 'targetPotential': return `Hdf ${formatPercent(stock.targetSnapshot?.avgPotential || 0)}`;
      default: return formatPrice(priceFor(stock));
    }
  }

  function sizeMetricValue(stock) {
    switch (state.sizeMetric) {
      case 'marketCap': return stock.marketCap;
      case 'volume': return volumeFor(stock);
      case 'change': return Math.abs(changeFor(stock));
      case 'relVolume': return stock.relVolume;
      case 'volatility': return stock.volatility;
      case 'targetPotential': return Math.max(0, stock.targetSnapshot?.avgPotential || 0);
      default: return stock.marketCap;
    }
  }

  function createLocalDemoPayload(period) {
    const source = window.BIST_DEMO_STOCKS || [];
    const volatility = { '1s': 1.2, '1g': 3.2, '1h': 6.5, '1a': 11, '3a': 18, '1y': 38 }[period] || 3.2;
    const dayKey = new Date().toISOString().slice(0, 10);
    const stocks = source.map((item) => {
      const random = localRandom(localSeed(`${item.symbol}|${period}|${dayKey}`));
      const change = clamp((random() - .46) * volatility * 2.4, -24, 24);
      const price = item.base * (.965 + random() * .07);
      const reference = price / (1 + change / 100);
      const spread = price * (.008 + random() * .025);
      const open = price + (random() - .5) * spread;
      return {
        symbol: item.symbol,
        name: item.name,
        sector: item.sector,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changeAmount: Number((price - reference).toFixed(2)),
        open: Number(open.toFixed(2)),
        high: Number((Math.max(open, price) + random() * spread).toFixed(2)),
        low: Number(Math.max(.01, Math.min(open, price) - random() * spread).toFixed(2)),
        volume: Math.round(4000000 + random() * 236000000),
        marketCap: item.cap,
        currency: 'TRY',
        source: 'demo',
      };
    }).sort((a, b) => b.marketCap - a.marketCap);
    return {
      period,
      mode: 'demo',
      sourceLabel: 'Demo veri · çevrimdışı ön izleme',
      updatedAt: new Date().toISOString(),
      stocks,
    };
  }

  function generateTimeline(stock, prevClose) {
    const rnd = localRandom(localSeed(`${stock.symbol}|timeline|${state.period}`));
    return TIMELINE_STEPS.map((step, index) => {
      if (index === TIMELINE_STEPS.length - 1) {
        return {
          ...step,
          price: stock.price,
          change: stock.change,
          changeAmount: stock.changeAmount,
          volume: stock.volume,
        };
      }
      const drift = (stock.change / 100) * step.progress;
      const noise = (rnd() - .5) * (1 - step.progress) * .04;
      let price = prevClose * (1 + drift + noise);
      if (index === 0) price = stock.open;
      price = clamp(price, stock.low * .985, stock.high * 1.015);
      const change = ((price - prevClose) / prevClose) * 100;
      const volume = Math.round(stock.volume * clamp(.12 + step.progress * .92 + (rnd() - .5) * .08, .08, 1));
      return {
        ...step,
        price: Number(price.toFixed(2)),
        change: Number(change.toFixed(2)),
        changeAmount: Number((price - prevClose).toFixed(2)),
        volume,
      };
    });
  }

  function syntheticSeries(symbol, endPrice, change, length = 240) {
    const rnd = localRandom(localSeed(`${symbol}|series|${state.period}|${length}`));
    let value = endPrice / (1 + change / 100);
    const out = [];
    const drift = (change / 100) / Math.max(20, length * .55);
    for (let i = 0; i < length; i += 1) {
      value *= 1 + drift + (rnd() - .5) * .016;
      out.push(Math.max(.01, value));
    }
    out[out.length - 1] = endPrice;
    return out;
  }

  function sma(values, length) { return average(values.slice(-Math.min(length, values.length))); }
  function ema(values, length) {
    const k = 2 / (length + 1);
    return values.reduce((acc, value, index) => (index === 0 ? value : value * k + acc * (1 - k)), values[0] || 0);
  }
  function stddev(values) {
    const mean = average(values);
    return Math.sqrt(average(values.map((v) => (v - mean) ** 2)));
  }
  function calcRsi(values, length = 14) {
    let gains = 0;
    let losses = 0;
    for (let i = Math.max(1, values.length - length); i < values.length; i += 1) {
      const diff = values[i] - values[i - 1];
      if (diff >= 0) gains += diff;
      else losses -= diff;
    }
    if (!losses) return 100;
    const rs = (gains / length) / (losses / length || 1);
    return 100 - (100 / (1 + rs));
  }
  function calcStochastic(values, length = 14) {
    const slice = values.slice(-Math.min(length, values.length));
    const low = Math.min(...slice);
    const high = Math.max(...slice);
    const close = values[values.length - 1];
    return ((close - low) / Math.max(.0001, high - low)) * 100;
  }

  function buildPivotSuites(stock) {
    const h = stock.high; const l = stock.low; const c = stock.price; const o = stock.open;
    const p = (h + l + c) / 3;
    return {
      classic: {
        pivot: p,
        r1: p * 2 - l,
        s1: p * 2 - h,
        r2: p + (h - l),
        s2: p - (h - l),
        r3: h + 2 * (p - l),
        s3: l - 2 * (h - p),
      },
      fibonacci: {
        pivot: p,
        r1: p + 0.382 * (h - l),
        s1: p - 0.382 * (h - l),
        r2: p + 0.618 * (h - l),
        s2: p - 0.618 * (h - l),
      },
      camarilla: {
        r3: c + (h - l) * 1.1 / 4,
        r4: c + (h - l) * 1.1 / 2,
        s3: c - (h - l) * 1.1 / 4,
        s4: c - (h - l) * 1.1 / 2,
      },
      woodie: {
        pivot: (h + l + 2 * o) / 4,
        r1: ((h + l + 2 * o) / 4) * 2 - l,
        s1: ((h + l + 2 * o) / 4) * 2 - h,
      },
    };
  }

  function buildEnrichedStocks(rawStocks) {
    const preliminary = rawStocks.map((stock, index) => {
      const baseSeed = localSeed(`${stock.symbol}|enrich|${state.period}|${index}`);
      const rnd = localRandom(baseSeed);
      const prevClose = Number((stock.price - stock.changeAmount).toFixed(2));
      const avgVolume = Math.round(stock.volume * (.58 + rnd() * .82));
      const relVolume = stock.volume / Math.max(1, avgVolume);
      const volatility = 1.1 + rnd() * 7.4;
      const yearLow = Math.min(stock.low * (.76 + rnd() * .14), stock.price * (.70 + rnd() * .16));
      const yearHigh = Math.max(stock.high * (1.08 + rnd() * .25), stock.price * (1.10 + rnd() * .35));
      const weekPerf = clamp(stock.change * (1.1 + rnd() * 1.6) + (rnd() - .5) * 5.5, -32, 32);
      const monthPerf = clamp(weekPerf * (1.2 + rnd() * .7) + (rnd() - .5) * 9, -48, 48);
      const yearPerf = clamp(monthPerf * (1.4 + rnd() * .7) + (rnd() - .5) * 16, -68, 118);
      const series = syntheticSeries(stock.symbol, stock.price, stock.change, 240);
      const ma20 = sma(series, 20);
      const ma50 = sma(series, 50);
      const ma200 = sma(series, 200);
      const ema20 = ema(series, 20);
      const ema50 = ema(series, 50);
      const rsi = calcRsi(series);
      const macdLine = ema(series, 12) - ema(series, 26);
      const signalLine = ema(series.slice(-50), 9);
      const stoch = calcStochastic(series, 14);
      const atr = stock.price * (0.012 + rnd() * 0.028);
      const bollSlice = series.slice(-20);
      const bollMean = average(bollSlice);
      const bollStd = stddev(bollSlice);
      const bollUpper = bollMean + bollStd * 2;
      const bollLower = bollMean - bollStd * 2;
      const trendScore = Number(stock.price > ma20) + Number(stock.price > ma50) + Number(stock.price > ma200);
      const buySignals = Number(rsi < 65) + Number(stock.price > ma20) + Number(stock.price > ema20) + Number(macdLine > signalLine) + Number(stoch < 80) + Number(stock.change > 0);
      const sellSignals = Number(rsi > 72) + Number(stock.price < ma20) + Number(stock.price < ema20) + Number(macdLine < signalLine) + Number(stoch > 85);
      const neutralSignals = 12 - buySignals - sellSignals;
      const fundamental = {
        pe: Number((5.8 + rnd() * 17.2).toFixed(1)),
        pb: Number((0.75 + rnd() * 4.2).toFixed(2)),
        evEbitda: Number((4.1 + rnd() * 9.4).toFixed(1)),
        roe: Number((8 + rnd() * 28).toFixed(1)),
        roa: Number((3 + rnd() * 13).toFixed(1)),
        grossMargin: Number((18 + rnd() * 30).toFixed(1)),
        ebitdaMargin: Number((9 + rnd() * 26).toFixed(1)),
        netMargin: Number((4 + rnd() * 19).toFixed(1)),
        dividendYield: Number((rnd() * 8.6).toFixed(1)),
        freeFloat: Number((17 + rnd() * 58).toFixed(1)),
        debtEbitda: Number(Math.max(0, rnd() * 3.5 - .2).toFixed(2)),
        salesGrowth: Number((rnd() * 36).toFixed(1)),
        profitGrowth: Number((rnd() * 44 - 6).toFixed(1)),
      };
      const pricePosition = ((stock.price - yearLow) / Math.max(.0001, yearHigh - yearLow)) * 100;
      const pivotSuites = buildPivotSuites(stock);
      const timeline = generateTimeline(stock, prevClose);
      const targetPotential = clamp((fundamental.profitGrowth * 0.45) + (fundamental.salesGrowth * 0.22) + (trendScore * 3.8) - (fundamental.debtEbitda * 2.1) + (rnd() - .5) * 11, -12, 68);
      const targetSnapshot = {
        avgPotential: Number(targetPotential.toFixed(2)),
        avgTarget: Number((stock.price * (1 + targetPotential / 100)).toFixed(2)),
        coverage: Math.max(2, Math.round(3 + rnd() * 5)),
        modelCount: Math.max(0, Math.round((targetPotential > 20 ? 2 : 1) + rnd() * 3)),
      };
      const flags = {
        newHigh: stock.price >= yearHigh * .97,
        newLow: stock.price <= yearLow * 1.03,
        tavan: stock.change >= 8.5,
        taban: stock.change <= -8.5,
        gapUp: stock.open > prevClose * 1.01,
        gapDown: stock.open < prevClose * 0.99,
      };
      return {
        ...stock,
        previousClose: prevClose,
        avgVolume,
        relVolume,
        volatility: Number(volatility.toFixed(2)),
        yearLow: Number(yearLow.toFixed(2)),
        yearHigh: Number(yearHigh.toFixed(2)),
        weekPerf: Number(weekPerf.toFixed(2)),
        monthPerf: Number(monthPerf.toFixed(2)),
        yearPerf: Number(yearPerf.toFixed(2)),
        pricePosition: Number(pricePosition.toFixed(1)),
        beta: Number((0.65 + rnd() * .95).toFixed(2)),
        fundamental,
        technical: {
          ma20, ma50, ma200, ema20, ema50,
          rsi, macdLine, signalLine, stoch, atr,
          bollUpper, bollLower,
          trendScore, buySignals, neutralSignals, sellSignals,
          trendText: trendScore >= 3 ? 'Güçlü pozitif' : trendScore === 2 ? 'Pozitif' : trendScore === 1 ? 'Nötr' : 'Zayıf',
          signalText: macdLine >= signalLine ? 'AL sinyali' : 'SAT sinyali',
        },
        pivots: pivotSuites,
        series,
        timeline,
        flags,
        targetSnapshot,
      };
    });

    const marketChange = Number((preliminary.reduce((sum, stock) => sum + changeFor(stock) * stock.marketCap, 0) / Math.max(1, preliminary.reduce((sum, stock) => sum + stock.marketCap, 0))).toFixed(2));
    return preliminary.map((stock) => ({
      ...stock,
      news: buildNews(stock, marketChange),
      aiSummary: buildAiSummary(stock, marketChange),
    }));
  }

  function buildNews(stock, marketChange) {
    const tags = [
      { label: 'KAP · Finansal Sonuç', level: 'important' },
      { label: 'Şirket Haberi', level: 'info' },
      { label: 'Teknik Görünüm', level: 'info' },
      { label: 'Sektör Akışı', level: 'critical' },
    ];
    return [
      {
        tag: tags[0].label,
        level: tags[0].level,
        title: `${stock.symbol} için çeyreklik görünüm izleniyor`,
        body: `Demo akışta ${stock.name} için FAVÖK marjı ${formatPctValue(stock.fundamental.ebitdaMargin)} ve net kâr büyümesi ${formatPctValue(stock.fundamental.profitGrowth)} olarak özetlenmiştir.`,
        source: 'Demo finansal akış',
        time: '12 dk önce',
        importance: 'Önemli',
      },
      {
        tag: tags[1].label,
        level: tags[1].level,
        title: `${stock.sector} sektöründe haber akışı hızlandı`,
        body: `${stock.symbol} hissesi bugün ${formatPercent(changeFor(stock))} performans gösterirken sektör ortalaması karşılaştırmalı analiz ekranında izlenebilir.`,
        source: 'Şirket özeti',
        time: '27 dk önce',
        importance: 'Bilgilendirme',
      },
      {
        tag: tags[2].label,
        level: tags[2].level,
        title: `${stock.symbol} için teknik seviyeler takip ediliyor`,
        body: `RSI ${stock.technical.rsi.toFixed(1)}, MACD görünümü ${stock.technical.signalText.toLowerCase()} ve ilk direnç ${formatPrice(stock.pivots.classic.r1)} seviyesinde.`,
        source: 'Teknik not',
        time: '43 dk önce',
        importance: 'Bilgilendirme',
      },
      {
        tag: tags[3].label,
        level: tags[3].level,
        title: `${stock.symbol}, BIST ortalamasına göre ${relativePerformanceFor(stock) >= 0 ? 'pozitif' : 'negatif'} ayrışıyor`,
        body: `Relatif performans ${formatPercent(changeFor(stock) - marketChange)} seviyesinde. Bu alan canlı KAP / haber entegrasyonuna uygun şekilde tasarlanmıştır.`,
        source: 'Piyasa akışı',
        time: '1 sa önce',
        importance: 'Kritik',
      },
    ];
  }

  function buildAiSummary(stock, marketChange) {
    const tone = changeFor(stock) >= 0 ? 'göreceli olarak güçlü' : 'baskı altında';
    const bullets = [
      `Güncel fiyat ${formatPrice(priceFor(stock))}; günlük değişim ${formatPercent(changeFor(stock))}.`,
      `Fiyat 52 haftalık bandın ${stock.pricePosition.toFixed(0)}% seviyesinde; bu da hissenin ${stock.pricePosition > 65 ? 'üst banda yakın' : stock.pricePosition < 35 ? 'alt banda yakın' : 'orta bölgede'} olduğunu gösterir.`,
      `Teknik görünüm ${stock.technical.trendText.toLowerCase()} · RSI ${stock.technical.rsi.toFixed(1)} · MACD ${stock.technical.signalText.toLowerCase()}.`,
      `${stock.symbol}, BIST 100 ortalamasına göre ${formatPercent(changeFor(stock) - marketChange)} relatif performans üretmektedir.`,
    ];
    return {
      title: `${stock.symbol} için otomatik nötr özet`,
      paragraph: `${stock.name}, ${stock.sector} sektörü içinde ${tone} bir görünüm sergiliyor. İşlem hacmi ortalamanın ${stock.relVolume.toFixed(2)} katı seviyesinde; temel tarafta F/K ${stock.fundamental.pe.toFixed(1)} ve temettü verimi ${formatPctValue(stock.fundamental.dividendYield)} olarak izleniyor.`,
      bullets,
    };
  }

  function activeUniverse() {
    return state.rawStocks.slice(0, state.limit);
  }

  function computeMarketSummary(stocks) {
    const list = stocks.length ? stocks : activeUniverse();
    const advances = list.filter((stock) => changeFor(stock) > 0.05).length;
    const declines = list.filter((stock) => changeFor(stock) < -0.05).length;
    const totalMarketCap = list.reduce((sum, stock) => sum + stock.marketCap, 0) || 1;
    const marketChange = Number((list.reduce((sum, stock) => sum + changeFor(stock) * stock.marketCap, 0) / totalMarketCap).toFixed(2));
    const totalVolume = list.reduce((sum, stock) => sum + volumeFor(stock), 0);
    const avgRelVolume = average(list.map((stock) => stock.relVolume || 1));
    const sectorMap = {};
    list.forEach((stock) => {
      if (!sectorMap[stock.sector]) sectorMap[stock.sector] = { sector: stock.sector, count: 0, change: 0, volume: 0 };
      sectorMap[stock.sector].count += 1;
      sectorMap[stock.sector].change += changeFor(stock);
      sectorMap[stock.sector].volume += volumeFor(stock);
    });
    const sectors = Object.values(sectorMap).map((item) => ({
      ...item,
      avgChange: item.change / item.count,
    })).sort((a, b) => b.avgChange - a.avgChange);
    return {
      advances,
      declines,
      unchanged: list.length - advances - declines,
      marketChange,
      totalVolume,
      totalMarketCap,
      avgRelVolume,
      sectors,
      strongestSector: sectors[0]?.sector || '—',
      weakestSector: sectors[sectors.length - 1]?.sector || '—',
      breadth: list.length ? (advances / list.length) * 100 : 0,
    };
  }

  function updateSummaryUI(summary) {
    state.marketSummary = summary;
    const market = $('#marketChange');
    market.textContent = formatPercent(summary.marketChange);
    market.className = summary.marketChange >= 0 ? 'value-gain' : 'value-loss';
    $('#advances').textContent = summary.advances;
    $('#declines').textContent = summary.declines;
    $('#selectedIndex').textContent = `BIST ${state.limit}`;
    $('#sourceLabel').textContent = state.sourceLabel;
    $('#updatedAt').textContent = `Son güncelleme: ${trDate.format(new Date(state.updatedAt))}`;
    $('#sourceDot').className = `source-dot ${state.sourceMode}`;
    $('#resultCount').textContent = `${state.filtered.length} hisse`;

    const cards = [
      { label: 'Piyasa Genişliği', value: `%${summary.breadth.toFixed(0)}`, note: `${summary.advances} yükselen · ${summary.declines} düşen`, tone: summary.breadth >= 50 ? 'gain' : 'loss' },
      { label: 'Toplam Hacim', value: compact(summary.totalVolume), note: `Ort. RVol ${summary.avgRelVolume.toFixed(2)}x`, tone: 'neutral' },
      { label: 'En Güçlü Sektör', value: summary.strongestSector, note: formatPercent(summary.sectors[0]?.avgChange || 0), tone: 'gain' },
      { label: 'En Zayıf Sektör', value: summary.weakestSector, note: formatPercent(summary.sectors[summary.sectors.length - 1]?.avgChange || 0), tone: 'loss' },
      { label: 'BIST 30 Etkisi', value: formatPercent(computeMarketSummary(activeUniverse().slice(0, 30)).marketChange), note: 'İlk 30 hisse ortalaması', tone: 'neutral' },
      { label: 'Volatilite Ruhu', value: `${average(activeUniverse().map((stock) => stock.volatility)).toFixed(2)}%`, note: 'Günlük sentez volatilite', tone: 'neutral' },
      { label: 'Hedef Potansiyeli Lideri', value: (() => { const leader = [...activeUniverse()].sort((a, b) => (b.targetSnapshot?.avgPotential || 0) - (a.targetSnapshot?.avgPotential || 0))[0]; return leader ? `${leader.symbol} ${formatPercent(leader.targetSnapshot?.avgPotential || 0)}` : '—'; })(), note: 'Konsensüs bazlı demo görünüm', tone: 'gain' },
    ];
    $('#overviewCards').innerHTML = cards.map((card) => `
      <article class="overview-card">
        <span>${card.label}</span>
        <strong class="value-${card.tone}">${card.value}</strong>
        <em>${card.note}</em>
      </article>`).join('');
  }

  function populateSectors() {
    const select = $('#sectorSelect');
    const current = select.value;
    const sectors = [...new Set(activeUniverse().map((stock) => stock.sector))].sort((a, b) => a.localeCompare(b, 'tr'));
    select.innerHTML = '<option value="all">Tüm sektörler</option>' + sectors.map((sector) => `<option value="${sector}">${sector}</option>`).join('');
    select.value = sectors.includes(current) ? current : 'all';
  }

  function applyQuickFilter(stocks) {
    const data = [...stocks];
    switch (state.quickFilter) {
      case 'gainers': return data.filter((stock) => changeFor(stock) > 0).sort((a, b) => changeFor(b) - changeFor(a));
      case 'losers': return data.filter((stock) => changeFor(stock) < 0).sort((a, b) => changeFor(a) - changeFor(b));
      case 'highVolume': return data.sort((a, b) => volumeFor(b) - volumeFor(a)).slice(0, Math.min(35, data.length));
      case 'volumeSpike': return data.filter((stock) => stock.relVolume > 1.45).sort((a, b) => b.relVolume - a.relVolume);
      case 'newHigh': return data.filter((stock) => priceFor(stock) >= stock.yearHigh * .97 || stock.flags.newHigh);
      case 'newLow': return data.filter((stock) => priceFor(stock) <= stock.yearLow * 1.03 || stock.flags.newLow);
      case 'tavan': return data.filter((stock) => changeFor(stock) >= 8 || stock.flags.tavan);
      case 'taban': return data.filter((stock) => changeFor(stock) <= -8 || stock.flags.taban);
      case 'gapUp': return data.filter((stock) => stock.flags.gapUp || stock.open > stock.previousClose);
      case 'gapDown': return data.filter((stock) => stock.flags.gapDown || stock.open < stock.previousClose);
      default: return data;
    }
  }

  function applyFilters(preserve = true) {
    const query = state.query.trim().toLocaleLowerCase('tr');
    let stocks = activeUniverse();
    if (state.sector !== 'all') stocks = stocks.filter((stock) => stock.sector === state.sector);
    if (query) {
      stocks = stocks.filter((stock) =>
        stock.symbol.toLocaleLowerCase('tr').includes(query) ||
        stock.name.toLocaleLowerCase('tr').includes(query) ||
        stock.sector.toLocaleLowerCase('tr').includes(query)
      );
    }
    stocks = applyQuickFilter(stocks);
    state.filtered = stocks;
    emptyState.hidden = state.filtered.length > 0;
    rebuildNodes(preserve);
    renderListTable();
    const summary = computeMarketSummary(state.filtered.length ? state.filtered : activeUniverse());
    updateSummaryUI(summary);
    renderSectorStats(summary);
    renderFavorites();
    renderAlerts();
    renderPortfolio();
    renderCompare();
    renderScannerResults();
    if (state.selected) renderDrawer(state.selected);
  }

  function rebuildNodes(preserve = true) {
    const values = state.filtered.map((stock) => sizeMetricValue(stock));
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 1);
    const old = new Map(state.nodes.map((node) => [node.stock.symbol, node]));
    const mobile = isMobileCanvas();
    const tablet = !mobile && state.width > 0 && state.width < 1050;
    state.nodes = state.filtered.map((stock, index) => {
      const oldNode = old.get(stock.symbol);
      const value = sizeMetricValue(stock);
      const normalized = (value - min) / Math.max(.0001, max - min);
      const radius = mobile
        ? 10 + normalized * 23
        : tablet
          ? 17 + normalized * 38
          : 22 + normalized * 48;
      return {
        stock,
        x: oldNode?.x ?? (state.width * (.14 + (index % 10) / 13) || 220),
        y: oldNode?.y ?? (state.height * (.12 + Math.floor(index / 10) / 14) || 220),
        vx: oldNode?.vx ?? 0,
        vy: oldNode?.vy ?? 0,
        tx: oldNode?.tx ?? 0,
        ty: oldNode?.ty ?? 0,
        r: radius,
        isNew: !oldNode,
      };
    });
    updateNodeTargets();
    state.nodes.forEach((node, index) => {
      if (!preserve || node.isNew) {
        const rnd = localRandom(localSeed(`${node.stock.symbol}|initial-layout|${state.width}|${state.height}`));
        node.x = clamp(node.tx + (rnd() - .5) * (mobile ? 5 : 10), node.r + 8, state.width - node.r - 8);
        node.y = clamp(node.ty + (rnd() - .5) * (mobile ? 5 : 10), node.r + 8, state.height - node.r - 8);
        node.vx = 0;
        node.vy = 0;
      }
      delete node.isNew;
    });
  }

  function updateNodeTargets() {
    if (!state.nodes.length) return;
    const mobile = isMobileCanvas();
    if (mobile) {
      const ordered = state.clusterMode
        ? [...state.nodes].sort((a, b) => a.stock.sector.localeCompare(b.stock.sector, 'tr') || b.r - a.r)
        : [...state.nodes].sort((a, b) => b.r - a.r);
      const paddingX = 22;
      const paddingY = 30;
      const columns = Math.max(7, Math.floor((state.width - paddingX * 2) / 36));
      const rows = Math.max(1, Math.ceil(ordered.length / columns));
      const gapX = (state.width - paddingX * 2) / Math.max(columns - 1, 1);
      const gapY = (state.height - paddingY * 2) / Math.max(rows - 1, 1);
      ordered.forEach((node, index) => {
        const row = Math.floor(index / columns);
        const col = index % columns;
        const offset = row % 2 ? gapX * .45 : 0;
        const rnd = localRandom(localSeed(`${node.stock.symbol}|mobile-grid`));
        node.tx = clamp(paddingX + col * gapX + offset + (rnd() - .5) * 5, node.r + 5, state.width - node.r - 5);
        node.ty = clamp(paddingY + row * gapY + (rnd() - .5) * 5, node.r + 5, state.height - node.r - 5);
      });
      return;
    }
    if (!state.clusterMode) {
      const centerX = state.width / 2;
      const centerY = state.height / 2;
      const golden = Math.PI * (3 - Math.sqrt(5));
      state.nodes.forEach((node, index) => {
        const radius = Math.sqrt(index + 1) * 42;
        const angle = index * golden;
        node.tx = clamp(centerX + Math.cos(angle) * radius, node.r + 26, state.width - node.r - 26);
        node.ty = clamp(centerY + Math.sin(angle) * radius, node.r + 26, state.height - node.r - 26);
      });
      return;
    }
    const groups = {};
    state.nodes.forEach((node) => {
      const key = node.stock.sector;
      if (!groups[key]) groups[key] = [];
      groups[key].push(node);
    });
    const sectors = Object.keys(groups).sort((a, b) => {
      const av = average(groups[a].map((n) => changeFor(n.stock)));
      const bv = average(groups[b].map((n) => changeFor(n.stock)));
      return bv - av;
    });
    const panelPaddingX = Math.max(80, state.width * 0.06);
    const panelPaddingY = Math.max(70, state.height * 0.07);
    const usableWidth = Math.max(260, state.width - panelPaddingX * 2);
    const usableHeight = Math.max(220, state.height - panelPaddingY * 2);
    const cols = Math.max(4, Math.ceil(Math.sqrt(sectors.length + 4)));
    const rows = Math.max(3, Math.ceil(sectors.length / cols));
    const gapX = usableWidth / cols;
    const gapY = usableHeight / rows;
    sectors.forEach((sector, sectorIndex) => {
      const col = sectorIndex % cols;
      const row = Math.floor(sectorIndex / cols);
      const cx = panelPaddingX + gapX * col + gapX / 2;
      const cy = panelPaddingY + gapY * row + gapY / 2;
      groups[sector].forEach((node, index) => {
        const ringSize = 7;
        const ring = Math.floor(index / ringSize) + 1;
        const angle = (index % ringSize) / ringSize * Math.PI * 2 + ring * 0.24;
        const distance = ring * 46 + (index % 4) * 8;
        node.tx = clamp(cx + Math.cos(angle) * distance, node.r + 18, state.width - node.r - 18);
        node.ty = clamp(cy + Math.sin(angle) * distance, node.r + 18, state.height - node.r - 18);
      });
    });
  }

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    const previousWidth = state.width;
    state.width = rect.width;
    state.height = rect.height;
    canvas.width = rect.width * state.dpr;
    canvas.height = rect.height * state.dpr;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
    const crossedBreakpoint = (previousWidth <= 700) !== (state.width <= 700) || (previousWidth < 1050) !== (state.width < 1050);
    if (state.filtered.length && (crossedBreakpoint || !state.nodes.length)) rebuildNodes(true);
    else updateNodeTargets();
    if (state.selected) drawMiniChart(state.selected);
  }

  function drawClusterLabels() {
    if (!state.clusterMode || isMobileCanvas()) return;
    const sectorMap = {};
    state.nodes.forEach((node) => {
      if (!sectorMap[node.stock.sector]) sectorMap[node.stock.sector] = [];
      sectorMap[node.stock.sector].push(node);
    });
    ctx.save();
    Object.entries(sectorMap).forEach(([sector, nodes]) => {
      const xs = nodes.map((node) => node.tx);
      const ys = nodes.map((node) => node.ty);
      const x = average(xs);
      const y = Math.min(...ys) - 56;
      const labelW = 150;
      ctx.fillStyle = 'rgba(255,255,255,.025)';
      ctx.strokeStyle = 'rgba(255,255,255,.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(clamp(x - labelW / 2, 8, state.width - labelW - 8), clamp(y - 12, 8, state.height - 40), labelW, 30, 14);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = 'rgba(190, 214, 202, .75)';
      ctx.font = '700 11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(sector, clamp(x, 82, state.width - 82), clamp(y + 8, 22, state.height - 20));
    });
    ctx.restore();
  }

  function colorFor(change, alpha = 1) {
    if (change > 0.1) return `rgba(39,228,154,${alpha})`;
    if (change < -0.1) return `rgba(255,93,125,${alpha})`;
    return `rgba(242,192,95,${alpha})`;
  }

  function drawNode(node) {
    const stock = node.stock;
    const drawR = node.r;
    const selected = state.selected?.symbol === stock.symbol;
    const hovered = state.hovered?.stock.symbol === stock.symbol;
    const change = changeFor(stock);

    ctx.save();
    ctx.translate(node.x, node.y);
    const gradient = ctx.createRadialGradient(-drawR * .26, -drawR * .28, drawR * .18, 0, 0, drawR * 1.05);
    if (change >= 0) {
      gradient.addColorStop(0, 'rgba(52, 255, 180, .84)');
      gradient.addColorStop(.46, 'rgba(20, 151, 102, .92)');
      gradient.addColorStop(1, 'rgba(8, 62, 44, .98)');
    } else {
      gradient.addColorStop(0, 'rgba(255, 108, 136, .82)');
      gradient.addColorStop(.46, 'rgba(169, 48, 76, .92)');
      gradient.addColorStop(1, 'rgba(72, 16, 31, .98)');
    }
    ctx.shadowColor = selected ? colorFor(change, .65) : 'rgba(0,0,0,.2)';
    ctx.shadowBlur = selected ? 24 : hovered ? 16 : 8;
    ctx.beginPath();
    ctx.arc(0, 0, drawR, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = selected ? 2.6 : hovered ? 1.9 : 1.2;
    ctx.strokeStyle = colorFor(change, selected ? .96 : hovered ? .82 : .5);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-drawR * .2, -drawR * .24, drawR * .55, Math.PI * 1.06, Math.PI * 1.62);
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = Math.max(1, drawR * .025);
    ctx.stroke();

    const symbolSize = fitText(stock.symbol, drawR * 1.48, Math.min(17, drawR * .3), 7, 800);
    ctx.font = `800 ${symbolSize}px Manrope, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f5fffa';
    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 4;
    ctx.fillText(stock.symbol, 0, -Math.max(8, drawR * .22));

    const changeText = formatPercent(change);
    const changeSize = Math.max(8, Math.min(15, drawR * .24));
    ctx.font = `800 ${changeSize}px Manrope, sans-serif`;
    ctx.fillText(changeText, 0, Math.max(0, drawR * .02));

    const info = bubbleInfoText(stock);
    ctx.shadowBlur = 0;
    const infoSize = state.bubbleInfo === 'price'
      ? Math.max(10, Math.min(15, drawR * .21))
      : Math.max(8, Math.min(12, drawR * .16));
    ctx.font = `${state.bubbleInfo === 'price' ? 700 : 600} ${infoSize}px Manrope, Inter, sans-serif`;
    ctx.fillStyle = 'rgba(245,255,250,.82)';
    if (drawR > 42) ctx.fillText(info, 0, drawR * .44);

    if (state.favorites.has(stock.symbol)) {
      ctx.fillStyle = '#ffd166';
      ctx.font = `700 ${Math.max(10, drawR * .18)}px Inter, sans-serif`;
      ctx.fillText('★', drawR * .48, -drawR * .5);
    }
    if (state.compare.has(stock.symbol)) {
      ctx.fillStyle = '#effbf4';
      ctx.font = `700 ${Math.max(9, drawR * .15)}px Inter, sans-serif`;
      ctx.fillText('⇄', -drawR * .48, drawR * .46);
    }
    ctx.restore();
  }

  function updatePhysics() {
    if (!state.nodes.length) return;
    const mobile = isMobileCanvas();
    const attraction = mobile ? 0.0018 : 0.0024;
    const damping = mobile ? 0.58 : 0.64;
    const maxSpeed = mobile ? 0.42 : 0.68;
    for (const node of state.nodes) {
      const ax = (node.tx - node.x) * attraction;
      const ay = (node.ty - node.y) * attraction;
      node.vx = capAbs((node.vx + ax) * damping, maxSpeed);
      node.vy = capAbs((node.vy + ay) * damping, maxSpeed);
      if (Math.abs(node.tx - node.x) < 0.5 && Math.abs(node.vx) < 0.035) node.vx = 0;
      if (Math.abs(node.ty - node.y) < 0.5 && Math.abs(node.vy) < 0.035) node.vy = 0;
      if (node !== state.dragging) {
        node.x += node.vx;
        node.y += node.vy;
      }
    }
    for (let i = 0; i < state.nodes.length; i += 1) {
      for (let j = i + 1; j < state.nodes.length; j += 1) {
        const a = state.nodes[i];
        const b = state.nodes[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || .001;
        const minDist = a.r + b.r + (mobile ? 3 : 7);
        if (dist < minDist) {
          const overlap = (minDist - dist) * (mobile ? 0.10 : 0.14);
          const nx = dx / dist;
          const ny = dy / dist;
          if (a !== state.dragging) { a.x -= nx * overlap; a.y -= ny * overlap; a.vx *= 0.45; a.vy *= 0.45; }
          if (b !== state.dragging) { b.x += nx * overlap; b.y += ny * overlap; b.vx *= 0.45; b.vy *= 0.45; }
        }
      }
    }
    state.nodes.forEach((node) => {
      node.x = clamp(node.x, node.r + 5, state.width - node.r - 5);
      node.y = clamp(node.y, node.r + 5, state.height - node.r - 5);
    });
  }

  function animate() {
    updatePhysics();
    ctx.clearRect(0, 0, state.width, state.height);
    drawClusterLabels();
    const ordered = [...state.nodes].sort((a, b) => Number(a === state.hovered || a.stock.symbol === state.selected?.symbol) - Number(b === state.hovered || b.stock.symbol === state.selected?.symbol));
    ordered.forEach(drawNode);
    state.animationId = requestAnimationFrame(animate);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  function nodeAt(x, y) {
    for (let i = state.nodes.length - 1; i >= 0; i -= 1) {
      const node = state.nodes[i];
      if (Math.hypot(x - node.x, y - node.y) <= node.r) return node;
    }
    return null;
  }
  function showTooltip(node, x, y) {
    if (isMobileCanvas() || !node) { tooltip.hidden = true; return; }
    const stock = node.stock;
    const klass = changeFor(stock) >= 0 ? 'gain' : 'loss';
    tooltip.innerHTML = `<strong>${stock.symbol} · ${stock.name}</strong><span>${stock.sector}</span><b class="${klass}">${formatPrice(priceFor(stock))} · ${formatPercent(changeFor(stock))}</b><span>${bubbleInfoText(stock)}</span>`;
    tooltip.hidden = false;
    const maxX = state.width - 220;
    const maxY = state.height - 120;
    tooltip.style.left = `${Math.max(0, Math.min(x + 12, maxX))}px`;
    tooltip.style.top = `${Math.max(0, Math.min(y + 12, maxY))}px`;
  }

  function updateMarketStatus() {
    const now = new Date();
    const day = now.getDay();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const open = day >= 1 && day <= 5 && minutes >= 600 && minutes < 1080;
    const el = $('#marketStatus');
    el.classList.toggle('open', open);
    el.querySelector('span').textContent = open ? 'Piyasa açık' : 'Piyasa kapalı';
    el.title = 'Resmî tatiller hariç saat bazlı tahmini durum';
  }

  function renderSectorStats(summary) {
    $('#sectorCountBadge').textContent = `${summary.sectors.length} sektör`;
    $('#sectorHeatList').innerHTML = summary.sectors.map((sector) => `
      <button class="sector-chip" data-sector="${sector.sector}">
        <strong>${sector.sector}</strong>
        <strong class="${sector.avgChange >= 0 ? 'value-gain' : 'value-loss'}">${formatPercent(sector.avgChange)}</strong>
        <span>${sector.count} hisse · Hacim ${compact(sector.volume)}</span>
        <div class="mini-progress"><i style="width:${clamp(Math.abs(sector.avgChange) * 10, 8, 100)}%; background:${sector.avgChange >= 0 ? 'linear-gradient(90deg, rgba(39,228,154,.2), var(--green))' : 'linear-gradient(90deg, rgba(255,93,125,.2), var(--red))'}"></i></div>
      </button>`).join('');
  }

  function toggleFavorite(symbol) {
    if (state.favorites.has(symbol)) state.favorites.delete(symbol);
    else state.favorites.add(symbol);
    saveSet(STORAGE.favorites, state.favorites);
    renderFavorites();
    if (state.selected?.symbol === symbol) syncDrawerButtons();
  }

  function toggleCompare(symbol) {
    if (state.compare.has(symbol)) {
      state.compare.delete(symbol);
    } else {
      if (state.compare.size >= 3) {
        const oldest = [...state.compare][0];
        state.compare.delete(oldest);
      }
      state.compare.add(symbol);
    }
    saveSet(STORAGE.compare, state.compare);
    renderCompare();
    renderListTable();
    if (state.selected?.symbol === symbol) syncDrawerButtons();
  }

  function togglePortfolioSymbol(stock) {
    const existing = state.portfolio.find((item) => item.symbol === stock.symbol);
    if (existing) {
      state.portfolio = state.portfolio.filter((item) => item.symbol !== stock.symbol);
    } else {
      state.portfolio = [...state.portfolio, { symbol: stock.symbol, qty: 50, cost: Number((priceFor(stock) * .95).toFixed(2)) }];
    }
    saveJson(STORAGE.portfolio, state.portfolio);
    renderPortfolio();
    if (state.selected?.symbol === stock.symbol) syncDrawerButtons();
  }

  function addAlertFor(stock) {
    const target = Number((priceFor(stock) * 1.02).toFixed(2));
    state.alerts.unshift({
      id: `${stock.symbol}-${Date.now()}`,
      symbol: stock.symbol,
      label: `${stock.symbol} fiyat ${formatPrice(target)} üzerine çıktığında`,
      time: 'Az önce',
      status: 'Aktif',
      target,
    });
    state.alerts = state.alerts.slice(0, 20);
    saveJson(STORAGE.alerts, state.alerts);
    renderAlerts();
  }

  function removeAlert(id) {
    state.alerts = state.alerts.filter((alert) => alert.id !== id);
    saveJson(STORAGE.alerts, state.alerts);
    renderAlerts();
  }

  function renderFavorites() {
    const favorites = activeUniverse().filter((stock) => state.favorites.has(stock.symbol));
    $('#favoriteCountBadge').textContent = favorites.length;
    $('#favoritesList').innerHTML = favorites.length ? favorites.map((stock) => `
      <article class="watch-card" data-symbol="${stock.symbol}">
        <div class="watch-main">
          <div class="table-logo">${stock.symbol.slice(0, 2)}</div>
          <div>
            <strong>${stock.symbol}</strong>
            <span>${stock.name}</span>
          </div>
        </div>
        <div class="watch-metrics">
          <b>${formatPrice(priceFor(stock))}</b>
          <em class="${changeFor(stock) >= 0 ? 'value-gain' : 'value-loss'}">${formatPercent(changeFor(stock))}</em>
        </div>
      </article>`).join('') : '<div class="empty-note">Henüz favori hisse eklenmedi.</div>';
  }

  function renderAlerts() {
    $('#alertCountBadge').textContent = state.alerts.length;
    $('#alertsList').innerHTML = state.alerts.length ? state.alerts.map((alert) => `
      <article class="alert-card">
        <div>
          <strong>${alert.symbol}</strong>
          <span>${alert.label}</span>
        </div>
        <div style="text-align:right">
          <div class="alert-status">${alert.status}</div>
          <button class="row-actions-btn" data-remove-alert="${alert.id}" style="margin-top:8px;border:0;background:transparent;color:var(--muted)">Sil</button>
        </div>
      </article>`).join('') : '<div class="empty-note">Alarm eklemek için bir hisse detayını açın.</div>';
  }

  function renderListTable() {
    const stocks = [...state.filtered].sort((a, b) => state.sortDescending ? changeFor(b) - changeFor(a) : changeFor(a) - changeFor(b));
    $('#stockTableBody').innerHTML = stocks.map((stock) => `
      <tr data-symbol="${stock.symbol}">
        <td><div class="table-stock"><span class="table-logo">${stock.symbol.slice(0,2)}</span><div><strong>${stock.symbol}</strong><span>${stock.name}</span></div></div></td>
        <td>${formatPrice(priceFor(stock))}</td>
        <td class="${changeFor(stock) >= 0 ? 'value-gain' : 'value-loss'}"><strong>${formatPercent(changeFor(stock))}</strong></td>
        <td>${compact(volumeFor(stock))}</td>
        <td>${stock.relVolume.toFixed(2)}x</td>
        <td>${stock.fundamental.pe.toFixed(1)}</td>
        <td>${stock.sector}</td>
        <td>
          <div class="row-actions">
            <button type="button" data-action="favorite" data-symbol="${stock.symbol}" class="${state.favorites.has(stock.symbol) ? 'active' : ''}">★</button>
            <button type="button" data-action="compare" data-symbol="${stock.symbol}" class="${state.compare.has(stock.symbol) ? 'active' : ''}">⇄</button>
          </div>
        </td>
      </tr>`).join('');
  }

  function renderScannerGroups() {
    $('#scannerGroups').innerHTML = SCAN_GROUPS.map((group) => `
      <section class="scanner-group">
        <h3>${group.title}</h3>
        <div class="scan-buttons">
          ${group.items.map((item) => `<button class="scan-btn ${state.activeScan === item.id ? 'active' : ''}" data-scan="${item.id}">${item.label}</button>`).join('')}
        </div>
      </section>`).join('');
  }

  function currentScanDefinition() {
    return SCAN_GROUPS.flatMap((group) => group.items).find((item) => item.id === state.activeScan) || SCAN_GROUPS[0].items[0];
  }

  function renderScannerResults() {
    const scan = currentScanDefinition();
    $('#scanResultMeta').textContent = scan?.label || '—';
    const rows = activeUniverse().filter(scan.test).sort((a, b) => changeFor(b) - changeFor(a));
    $('#scannerTableBody').innerHTML = rows.length ? rows.map((stock) => `
      <tr data-symbol="${stock.symbol}">
        <td><div class="table-stock"><span class="table-logo">${stock.symbol.slice(0,2)}</span><div><strong>${stock.symbol}</strong><span>${stock.name}</span></div></div></td>
        <td>${formatPrice(priceFor(stock))}</td>
        <td class="${changeFor(stock) >= 0 ? 'value-gain' : 'value-loss'}"><strong>${formatPercent(changeFor(stock))}</strong></td>
        <td>${stock.fundamental.pe.toFixed(1)}</td>
        <td>${stock.fundamental.pb.toFixed(2)}</td>
        <td>${stock.technical.rsi.toFixed(1)}</td>
        <td>${stock.relVolume.toFixed(2)}x</td>
        <td>${scan.reason(stock)}</td>
      </tr>`).join('') : '<tr><td colspan="8" class="value-neutral">Seçili taramada eşleşen hisse bulunamadı.</td></tr>';
  }

  function renderPortfolio() {
    const rows = state.portfolio.map((holding) => {
      const stock = activeUniverse().find((item) => item.symbol === holding.symbol);
      if (!stock) return null;
      const price = priceFor(stock);
      const marketValue = holding.qty * price;
      const dayPnl = holding.qty * changeAmountFor(stock);
      const totalPnl = holding.qty * (price - holding.cost);
      return { ...holding, stock, price, marketValue, dayPnl, totalPnl };
    }).filter(Boolean);

    const totalValue = rows.reduce((sum, row) => sum + row.marketValue, 0);
    const totalCost = rows.reduce((sum, row) => sum + row.qty * row.cost, 0);
    const totalPnl = totalValue - totalCost;
    const dayPnl = rows.reduce((sum, row) => sum + row.dayPnl, 0);
    const weightedChange = rows.reduce((sum, row) => sum + changeFor(row.stock) * row.marketValue, 0) / Math.max(totalValue, 1);
    const rel = weightedChange - (state.marketSummary.marketChange || 0);
    $('#portfolioRelative').textContent = `BIST'e göre ${formatPercent(rel)}`;

    const best = rows.slice().sort((a, b) => b.dayPnl - a.dayPnl)[0];
    const worst = rows.slice().sort((a, b) => a.dayPnl - b.dayPnl)[0];
    const beta = rows.length ? average(rows.map((row) => row.stock.beta)) : 0;
    $('#portfolioSummaryCards').innerHTML = [
      { label: 'Toplam Portföy', value: formatPrice(totalValue), note: `${rows.length} hisse` },
      { label: 'Günlük K/Z', value: formatPrice(dayPnl), note: formatPercent(weightedChange), tone: dayPnl >= 0 ? 'gain' : 'loss' },
      { label: 'Toplam K/Z', value: formatPrice(totalPnl), note: totalPnl >= 0 ? 'Kârda' : 'Zararda', tone: totalPnl >= 0 ? 'gain' : 'loss' },
      { label: 'Portföy Beta', value: beta.toFixed(2), note: best ? `En güçlü ${best.stock.symbol}` : '—' },
      { label: 'En İyi Katkı', value: best ? `${best.stock.symbol} · ${formatPrice(best.dayPnl)}` : '—', note: best ? formatPercent(changeFor(best.stock)) : '—', tone: 'gain' },
      { label: 'En Zayıf Katkı', value: worst ? `${worst.stock.symbol} · ${formatPrice(worst.dayPnl)}` : '—', note: worst ? formatPercent(changeFor(worst.stock)) : '—', tone: 'loss' },
      { label: 'Sektör Sayısı', value: `${new Set(rows.map((row) => row.stock.sector)).size}`, note: 'Dağılım çeşitliliği' },
      { label: 'Portföy RVol', value: rows.length ? `${average(rows.map((row) => row.stock.relVolume)).toFixed(2)}x` : '—', note: 'Ortalama göreceli hacim' },
    ].map((card) => `
      <article class="summary-card">
        <span>${card.label}</span>
        <strong class="${card.tone ? `value-${card.tone}` : ''}">${card.value}</strong>
        <span>${card.note}</span>
      </article>`).join('');

    $('#portfolioTableBody').innerHTML = rows.length ? rows.map((row) => {
      const weight = totalValue ? row.marketValue / totalValue * 100 : 0;
      return `
      <tr>
        <td><div class="table-stock"><span class="table-logo">${row.stock.symbol.slice(0,2)}</span><div><strong>${row.stock.symbol}</strong><span>${row.stock.name}</span></div></div></td>
        <td>${row.qty}</td>
        <td>${formatPrice(row.cost)}</td>
        <td>${formatPrice(row.price)}</td>
        <td>${formatPrice(row.marketValue)}</td>
        <td class="${row.dayPnl >= 0 ? 'value-gain' : 'value-loss'}">${formatPrice(row.dayPnl)}</td>
        <td class="${row.totalPnl >= 0 ? 'value-gain' : 'value-loss'}">${formatPrice(row.totalPnl)}</td>
        <td>%${row.weight ? row.weight.toFixed(1) : weight.toFixed(1)}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="8">Portföy boş.</td></tr>';

    const sectorMap = {};
    rows.forEach((row) => {
      sectorMap[row.stock.sector] = (sectorMap[row.stock.sector] || 0) + row.marketValue;
    });
    const sectors = Object.entries(sectorMap).sort((a, b) => b[1] - a[1]);
    $('#portfolioSectorList').innerHTML = sectors.length ? sectors.map(([sector, value]) => {
      const percent = totalValue ? value / totalValue * 100 : 0;
      return `
        <div class="allocation-row">
          <div class="rail-card-head"><strong>${sector}</strong><span>%${percent.toFixed(1)}</span></div>
          <div class="allocation-bar"><i style="width:${percent.toFixed(1)}%"></i></div>
        </div>`;
    }).join('') : '<div class="empty-note">Portföye hisse ekleyin.</div>';
  }

  function renderCompare() {
    const stocks = activeUniverse().filter((stock) => state.compare.has(stock.symbol)).slice(0, 3);
    $('#compareMeta').textContent = `${stocks.length}/3 hisse`;
    $('#compareSelection').innerHTML = stocks.length ? stocks.map((stock) => `
      <div class="compare-pill">
        <strong>${stock.symbol}</strong>
        <span>${stock.name}</span>
        <button data-remove-compare="${stock.symbol}">×</button>
      </div>`).join('') : '<div class="empty-note">Karşılaştırmak istediğiniz hisseleri baloncuk veya tablo üzerinden ekleyin.</div>';
    if (!stocks.length) {
      $('#compareHeadRow').innerHTML = '<th>Metrik</th>';
      $('#compareTableBody').innerHTML = '<tr><td>Henüz hisse seçilmedi.</td></tr>';
      $('#compareBars').innerHTML = '<div class="empty-note">Karşılaştırma grafiği için hisse seçin.</div>';
      return;
    }
    $('#compareHeadRow').innerHTML = '<th>Metrik</th>' + stocks.map((stock) => `<th>${stock.symbol}</th>`).join('');
    const metrics = [
      ['Fiyat', (s) => formatPrice(priceFor(s))],
      ['Günlük Değişim', (s) => formatPercent(changeFor(s))],
      ['1 Hafta', (s) => formatPercent(s.weekPerf)],
      ['1 Ay', (s) => formatPercent(s.monthPerf)],
      ['Piyasa Değeri', (s) => `${compact(s.marketCap)} ₺`],
      ['F/K', (s) => s.fundamental.pe.toFixed(1)],
      ['PD/DD', (s) => s.fundamental.pb.toFixed(2)],
      ['Özkaynak Karlılığı', (s) => formatPctValue(s.fundamental.roe)],
      ['Temettü Verimi', (s) => formatPctValue(s.fundamental.dividendYield)],
      ['RSI', (s) => s.technical.rsi.toFixed(1)],
      ['MA20', (s) => formatPrice(s.technical.ma20)],
      ['İşlem Hacmi', (s) => compact(volumeFor(s))],
      ['RVol', (s) => `${s.relVolume.toFixed(2)}x`],
      ['Hedef Potansiyeli', (s) => formatPercent(s.targetSnapshot?.avgPotential || 0)],
      ['Trend', (s) => s.technical.trendText],
    ];
    $('#compareTableBody').innerHTML = metrics.map(([label, formatter]) => `
      <tr>
        <td><strong>${label}</strong></td>
        ${stocks.map((stock) => `<td class="${label.includes('Değişim') && changeFor(stock) < 0 ? 'value-loss' : label.includes('Değişim') && changeFor(stock) >= 0 ? 'value-gain' : ''}">${formatter(stock)}</td>`).join('')}
      </tr>`).join('');

    $('#compareBars').innerHTML = stocks.map((stock) => {
      const day = clamp(Math.abs(changeFor(stock)) * 8, 8, 100);
      const week = clamp(Math.abs(stock.weekPerf) * 3, 8, 100);
      const month = clamp(Math.abs(stock.monthPerf) * 2, 8, 100);
      const tone = changeFor(stock) >= 0 ? 'var(--green)' : 'var(--red)';
      return `
        <div class="bar-row">
          <strong>${stock.symbol}</strong>
          <div class="bar-metrics"><span>Gün</span><div class="bar-track"><i style="width:${day}%; background:${tone}"></i></div><span>${formatPercent(changeFor(stock))}</span></div>
          <div class="bar-metrics"><span>1H</span><div class="bar-track"><i style="width:${week}%; background:${tone}"></i></div><span>${formatPercent(stock.weekPerf)}</span></div>
          <div class="bar-metrics"><span>1A</span><div class="bar-track"><i style="width:${month}%; background:${tone}"></i></div><span>${formatPercent(stock.monthPerf)}</span></div>
        </div>`;
    }).join('');
  }

  function renderMetricGrid(targetId, items) {
    const target = $(targetId);
    if (!target) return;
    target.innerHTML = items.map((item) => `
      <div${item.wide ? ' class="wide"' : ''}${item.tone ? ` data-tone="${item.tone}"` : ''}>
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </div>`).join('');
  }

  function renderSummaryChips(targetId, items) {
    const target = $(targetId);
    if (!target) return;
    target.innerHTML = items.map((item) => `
      <div class="analysis-chip ${item.tone || ''}">
        <span>${item.label}</span>
        <strong>${item.value}</strong>
      </div>`).join('');
  }

  function sectorPeerAverage(stock, field) {
    const peers = activeUniverse().filter((item) => item.sector === stock.sector);
    const values = peers.map((item) => item.fundamental[field]);
    return average(values);
  }

  function syncDrawerButtons() {
    if (!state.selected) return;
    const symbol = state.selected.symbol;
    $('#drawerFavoriteBtn').classList.toggle('active', state.favorites.has(symbol));
    $('#drawerFavoriteBtn').textContent = state.favorites.has(symbol) ? '★ Favoride' : '☆ Favori';
    $('#drawerCompareBtn').classList.toggle('active', state.compare.has(symbol));
    $('#drawerCompareBtn').textContent = state.compare.has(symbol) ? '⇄ Karşılaştırmada' : '⇄ Karşılaştır';
    const inPortfolio = state.portfolio.some((item) => item.symbol === symbol);
    $('#drawerPortfolioBtn').classList.toggle('active', inPortfolio);
    $('#drawerPortfolioBtn').textContent = inPortfolio ? '✓ Portföyde' : '＋ Portföy';
  }

  const CHART_PERIODS = {
    '1g': { label: '1 Gün', count: 36 },
    '1h': { label: '1 Hafta', count: 60 },
    '1a': { label: '1 Ay', count: 90 },
    '3a': { label: '3 Ay', count: 150 },
    '1y': { label: '1 Yıl', count: 240 },
  };

  function chartSeriesFor(stock) {
    const config = CHART_PERIODS[state.drawerChartPeriod] || CHART_PERIODS['1a'];
    const source = stock.series || [];
    const values = source.slice(-Math.min(config.count, source.length));
    const rnd = localRandom(localSeed(`${stock.symbol}|volume-chart|${state.drawerChartPeriod}`));
    const base = Math.max(1, volumeFor(stock) / Math.max(values.length, 1));
    const volumes = values.map((value, index) => {
      const previous = values[Math.max(0, index - 1)] || value;
      const movement = Math.abs(value / Math.max(previous, .0001) - 1);
      return base * (.45 + rnd() * 1.25 + movement * 35);
    });
    return { values, volumes, config };
  }

  function createLocalTargetPayload(stock) {
    const institutions = [
      ['İş Yatırım', 'https://hedeffiyat.com.tr/kurum/is-yatirim-menkul-degerler-8'],
      ['Deniz Yatırım', 'https://hedeffiyat.com.tr/kurum/deniz-yatirim-13'],
      ['Ak Yatırım', 'https://hedeffiyat.com.tr/kurum/ak-yatirim-6'],
      ['Yatırım Finansman', 'https://hedeffiyat.com.tr/kurum/yatirim-finansman-28'],
      ['TEB Yatırım', 'https://hedeffiyat.com.tr/kurum/teb-yatirim-11'],
      ['İntegral Yatırım', 'https://hedeffiyat.com.tr/kurum/integral-yatirim-10'],
      ['Citi Bank', 'https://hedeffiyat.com.tr/kurum/citi-bank-34'],
    ];
    const rnd = localRandom(localSeed(`${stock.symbol}|targets-demo`));
    const items = institutions.slice(0, 5 + Math.floor(rnd() * 3)).map(([institution, url], index) => {
      const potential = 8 + rnd() * 58 - (index === 4 ? rnd() * 14 : 0);
      const targetPrice = priceFor(stock) * (1 + potential / 100);
      const recommendation = potential >= 25 ? (index % 3 === 0 ? 'Endeks Üstü Getiri' : 'Al') : potential >= 7 ? 'Tut' : 'Endeks Altı Getiri';
      return {
        institution,
        targetPrice: Number(targetPrice.toFixed(2)),
        potential: Number(potential.toFixed(2)),
        recommendation,
        date: `${8 + index} Temmuz 2026`,
        url,
        source: 'demo',
      };
    });
    return { symbol: stock.symbol, mode: 'demo', sourceLabel: 'Demo kurum önerileri · HedefFiyat bağlantısına hazır', items };
  }

  function recommendationTone(text) {
    const value = String(text || '').toLocaleLowerCase('tr');
    if (value.includes('sat') || value.includes('altı')) return 'sell';
    if (value.includes('tut') || value.includes('nötr') || value.includes('paralel') || value.includes('yok')) return 'hold';
    return 'buy';
  }

  function shortMonthLabel(offsetFromNow) {
    const date = new Date();
    date.setMonth(date.getMonth() + offsetFromNow);
    return date.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' });
  }

  function buildTargetInsightModel(payload, stock) {
    const rawItems = Array.isArray(payload?.items) ? payload.items : [];
    const baseRnd = localRandom(localSeed(`${stock.symbol}|target-insights|${payload?.mode || 'demo'}`));
    const items = rawItems.map((item, index) => {
      const tone = recommendationTone(item.recommendation);
      const seeded = localRandom(localSeed(`${stock.symbol}|${item.institution}|insight|${index}`));
      const previousTarget = Math.max(0.01, Number((Number(item.targetPrice) * (0.88 + seeded() * 0.18)).toFixed(2)));
      const revisionPct = ((Number(item.targetPrice) / Math.max(previousTarget, .0001)) - 1) * 100;
      const hitRate = Math.round(50 + seeded() * 42);
      const avgAlpha = Number((seeded() * 18 - 2).toFixed(1));
      const score = Math.round(Math.min(96, 54 + seeded() * 30 + (tone === 'buy' ? 9 : tone === 'hold' ? 3 : -4)));
      const modelWeight = tone === 'buy' ? 1 : tone === 'hold' ? .45 : .12;
      const inModelPortfolio = seeded() < modelWeight;
      return {
        ...item,
        currentPotential: ((Number(item.targetPrice) / Math.max(priceFor(stock), .0001)) - 1) * 100,
        previousTarget,
        revisionPct: Number(revisionPct.toFixed(2)),
        hitRate,
        avgAlpha,
        score,
        inModelPortfolio,
      };
    });
    if (!items.length) return { ...payload, items, analysis: null };
    const avgTarget = average(items.map((item) => Number(item.targetPrice) || 0));
    const potentials = items.map((item) => item.currentPotential);
    const avgPotential = average(potentials);
    const minTarget = Math.min(...items.map((item) => Number(item.targetPrice) || 0));
    const maxTarget = Math.max(...items.map((item) => Number(item.targetPrice) || 0));
    const distribution = { buy: 0, hold: 0, sell: 0 };
    items.forEach((item) => { distribution[recommendationTone(item.recommendation)] += 1; });
    const history = Array.from({ length: 6 }, (_, index) => {
      if (index === 5) {
        return { label: shortMonthLabel(0), avgTarget, minTarget, maxTarget };
      }
      const progress = index / 5;
      const factor = 0.82 + progress * 0.16 + (baseRnd() - .5) * 0.06;
      const pointAvg = avgTarget * factor;
      return {
        label: shortMonthLabel(index - 5),
        avgTarget: Number(pointAvg.toFixed(2)),
        minTarget: Number((pointAvg * (0.92 - baseRnd() * 0.03)).toFixed(2)),
        maxTarget: Number((pointAvg * (1.08 + baseRnd() * 0.03)).toFixed(2)),
      };
    });
    const modelPortfolio = items.filter((item) => item.inModelPortfolio).sort((a, b) => b.score - a.score);
    const institutionScores = [...items].sort((a, b) => b.score - a.score);
    return {
      ...payload,
      items,
      analysis: {
        avgTarget, avgPotential, minTarget, maxTarget, distribution, history,
        modelPortfolio, institutionScores,
        topTarget: institutionScores[0],
        modelOverlapRatio: items.length ? (modelPortfolio.length / items.length) * 100 : 0,
      },
    };
  }

  function renderTargetInsights(analysis, stock) {
    const target = $('#targetInsights');
    if (!analysis) { target.innerHTML = ''; return; }
    const price = priceFor(stock);
    const total = Math.max(analysis.institutionScores.length, 1);
    const rangeMin = Math.min(price, analysis.minTarget);
    const rangeMax = Math.max(price, analysis.maxTarget);
    const leftFor = (value) => clamp(((value - rangeMin) / Math.max(.0001, rangeMax - rangeMin)) * 100, 0, 100);
    const histValues = analysis.history.flatMap((item) => [item.minTarget, item.avgTarget, item.maxTarget]);
    const histMin = Math.min(...histValues);
    const histMax = Math.max(...histValues);
    target.innerHTML = `
      <div class="target-insight-grid">
        <section class="insight-card wide">
          <div class="insight-head"><strong>Konsensüs Dağılımı</strong><span>${analysis.institutionScores.length} kurum</span></div>
          <div class="consensus-track">
            <div class="consensus-band"></div>
            <div class="consensus-current" style="left:${leftFor(price)}%"><span>Güncel ${formatPrice(price)}</span></div>
            ${analysis.institutionScores.map((item) => `<button type="button" class="consensus-point ${recommendationTone(item.recommendation)}" style="left:${leftFor(Number(item.targetPrice))}%" title="${item.institution} · ${formatPrice(Number(item.targetPrice))}"></button>`).join('')}
          </div>
          <div class="consensus-scale"><span>${formatPrice(rangeMin)}</span><span>Ort. ${formatPrice(analysis.avgTarget)}</span><span>${formatPrice(rangeMax)}</span></div>
        </section>

        <section class="insight-card wide">
          <div class="insight-head"><strong>Hedef Fiyat Revizyon Geçmişi</strong><span>Ortalama konsensüs</span></div>
          <div class="revision-chart">
            ${analysis.history.map((point) => {
              const avgH = clamp(((point.avgTarget - histMin) / Math.max(.0001, histMax - histMin)) * 100, 8, 100);
              const rangeH = clamp(((point.maxTarget - point.minTarget) / Math.max(.0001, histMax - histMin)) * 100, 8, 100);
              return `<div class="revision-col"><span>${point.label}</span><div class="revision-bar"><i class="revision-range" style="height:${rangeH}%"></i><b class="revision-avg" style="height:${avgH}%"></b></div><strong>${formatPrice(point.avgTarget)}</strong></div>`;
            }).join('')}
          </div>
          <div class="revision-note">En güncel konsensüs ${formatPercent(analysis.avgPotential)} potansiyel ima ediyor.</div>
        </section>

        <section class="insight-card">
          <div class="insight-head"><strong>Model Portföy Kesişimi</strong><span>${analysis.modelPortfolio.length} kurum</span></div>
          <div class="micro-stats">
            <div><span>Kesişim Oranı</span><strong class="${analysis.modelOverlapRatio >= 40 ? 'value-gain' : 'value-neutral'}">%${analysis.modelOverlapRatio.toFixed(0)}</strong></div>
            <div><span>Ortalama Potansiyel</span><strong class="${analysis.avgPotential >= 0 ? 'value-gain' : 'value-loss'}">${formatPercent(analysis.avgPotential)}</strong></div>
          </div>
          <div class="pill-stack">${(analysis.modelPortfolio.length ? analysis.modelPortfolio : analysis.institutionScores.slice(0, 3)).map((item) => `<div class="portfolio-pill"><strong>${item.institution}</strong><span>${item.recommendation} · ${formatPrice(Number(item.targetPrice))}</span></div>`).join('')}</div>
        </section>

        <section class="insight-card">
          <div class="insight-head"><strong>Kurum Performans Skoru</strong><span>Demo doğruluk skoru</span></div>
          <div class="score-list">${analysis.institutionScores.slice(0, 5).map((item, index) => `<div class="score-row"><div><strong>#${index + 1} ${item.institution}</strong><span>İsabet ${item.hitRate}% · Alfa ${formatPercent(item.avgAlpha)}</span></div><div class="score-badge">${item.score}</div></div>`).join('')}</div>
        </section>
      </div>`;
  }

  function renderTargetRecommendations(payload, stock) {
    const normalized = payload?.analysis ? payload : buildTargetInsightModel(payload, stock);
    const items = Array.isArray(normalized?.items) ? normalized.items : [];
    const analysis = normalized?.analysis;
    const note = $('#targetSourceNote');
    note.className = `target-source-note ${normalized?.mode === 'live' ? 'live' : 'demo'}`;
    note.innerHTML = normalized?.mode === 'live'
      ? `<strong>Kaynak:</strong> HedefFiyat.com üzerindeki halka açık kurum sayfaları. ${items.length} güncel kayıt bulundu. <em>Revizyon geçmişi, model portföy kesişimi ve kurum performans skoru prototip amaçlı sentezlenmiştir.</em>`
      : `<strong>Demo görünüm:</strong> HedefFiyat.com bağlantısı erişilemedi veya bu hisse için sonuç bulunamadı. Kurum kartları ile revizyon / performans alanları prototip amaçlı üretilmiştir.`;
    if (!items.length || !analysis) {
      $('#targetConsensus').innerHTML = '';
      $('#targetInsights').innerHTML = '';
      $('#targetRecommendations').innerHTML = '<div class="target-loading">Bu hisse için kurum önerisi bulunamadı.</div>';
      return;
    }
    const total = Math.max(items.length, 1);
    $('#targetConsensus').innerHTML = `
      <div class="consensus-card"><span>Ortalama Hedef Fiyat</span><strong>${formatPrice(analysis.avgTarget)}</strong></div>
      <div class="consensus-card"><span>Ortalama Getiri Potansiyeli</span><strong class="${analysis.avgPotential >= 0 ? 'value-gain' : 'value-loss'}">${formatPercent(analysis.avgPotential)}</strong></div>
      <div class="consensus-card"><span>Hedef Fiyat Aralığı</span><strong>${formatPrice(analysis.minTarget)} — ${formatPrice(analysis.maxTarget)}</strong></div>
      <div class="consensus-card"><span>Model Portföy Kesişimi</span><strong>${analysis.modelPortfolio.length}/${items.length}</strong></div>
      <div class="recommendation-distribution">
        <span>Tavsiye Dağılımı</span>
        <div class="distribution-bar">
          <i class="buy" style="width:${analysis.distribution.buy / total * 100}%"></i>
          <i class="hold" style="width:${analysis.distribution.hold / total * 100}%"></i>
          <i class="sell" style="width:${analysis.distribution.sell / total * 100}%"></i>
        </div>
        <div class="distribution-labels"><span>Olumlu ${analysis.distribution.buy}</span><span>Nötr/Tut ${analysis.distribution.hold}</span><span>Olumsuz ${analysis.distribution.sell}</span></div>
      </div>`;
    renderTargetInsights(analysis, stock);
    $('#targetRecommendations').innerHTML = items.map((item) => {
      const tone = recommendationTone(item.recommendation);
      const revisionClass = item.revisionPct >= 0 ? 'value-gain' : 'value-loss';
      return `
        <article class="target-card">
          <div class="target-card-head">
            <div><strong>${item.institution}</strong><span>${item.date || 'Tarih belirtilmedi'}</span></div>
            <span class="rec-badge ${tone}">${item.recommendation || 'Tavsiye Yok'}</span>
          </div>
          <div class="target-card-body">
            <div class="target-metric"><span>Hedef Fiyat</span><strong>${formatPrice(Number(item.targetPrice))}</strong></div>
            <div class="target-metric"><span>Mevcut Fiyata Göre</span><strong class="${item.currentPotential >= 0 ? 'value-gain' : 'value-loss'}">${formatPercent(item.currentPotential)}</strong></div>
            <div class="target-metric"><span>Revizyon</span><strong class="${revisionClass}">${formatPercent(item.revisionPct)}</strong></div>
            <div class="target-metric"><span>Önceki Hedef</span><strong>${formatPrice(Number(item.previousTarget))}</strong></div>
            <div class="target-metric"><span>Kurum Skoru</span><strong>${item.score}/100</strong></div>
            <div class="target-metric"><span>İsabet Oranı</span><strong>${item.hitRate}%</strong></div>
          </div>
          <div class="target-card-foot"><span>${normalized.mode === 'live' ? 'HedefFiyat.com verisi' : 'Demo veri'}${item.inModelPortfolio ? ' · Model portföyde' : ''}</span>${item.url ? `<a href="${item.url}" target="_blank" rel="noopener noreferrer">Kaynağı aç ↗</a>` : ''}</div>
        </article>`;
    }).join('');
  }

  async function loadTargetRecommendations(stock) {
    const symbol = stock.symbol;
    $('#targetSourceNote').className = 'target-source-note';
    $('#targetSourceNote').textContent = 'Kurum önerileri ve hedef fiyatlar hazırlanıyor…';
    $('#targetConsensus').innerHTML = '';
    $('#targetInsights').innerHTML = '';
    $('#targetRecommendations').innerHTML = '<div class="target-loading">Kurum konsensüsü hazırlanıyor…</div>';
    if (state.targetCache.has(symbol)) {
      renderTargetRecommendations(state.targetCache.get(symbol), stock);
      return;
    }
    if (window.BIST_STATIC_MODE) {
      const fallback = buildTargetInsightModel(createLocalTargetPayload(stock), stock);
      state.targetCache.set(symbol, fallback);
      renderTargetRecommendations(fallback, stock);
      return;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5500);
    try {
      const response = await fetch(`/api/targets?symbol=${encodeURIComponent(symbol)}&price=${encodeURIComponent(priceFor(stock))}`, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (!payload?.items?.length) throw new Error('Kayıt bulunamadı');
      const enriched = buildTargetInsightModel(payload, stock);
      state.targetCache.set(symbol, enriched);
      if (state.selected?.symbol === symbol) renderTargetRecommendations(enriched, stock);
    } catch (error) {
      const fallback = buildTargetInsightModel(createLocalTargetPayload(stock), stock);
      state.targetCache.set(symbol, fallback);
      if (state.selected?.symbol === symbol) renderTargetRecommendations(fallback, stock);
    } finally {
      clearTimeout(timeout);
    }
  }

  function renderDrawer(stock) {
    if (!stock) return;
    state.selected = stock;
    const current = currentPoint(stock);
    $('#drawerLogo').textContent = stock.symbol.slice(0, 2);
    $('#drawerSymbol').textContent = stock.symbol;
    $('#drawerName').textContent = stock.name;
    $('#drawerSector').textContent = stock.sector;
    $('#drawerPrice').textContent = formatPrice(current.price);
    const changeEl = $('#drawerChange');
    changeEl.textContent = `${formatPercent(current.change)} · ${current.changeAmount >= 0 ? '+' : ''}${trNumber.format(current.changeAmount)} ₺`;
    changeEl.className = `change-pill ${current.change >= 0 ? 'gain' : 'loss'}`;

    renderMetricGrid('#drawerOverviewGrid', [
      { label: 'Açılış', value: formatPrice(stock.open) },
      { label: 'Önceki Kapanış', value: formatPrice(stock.previousClose) },
      { label: 'Günün En Yükseği', value: formatPrice(stock.high) },
      { label: 'Günün En Düşüğü', value: formatPrice(stock.low) },
      { label: 'İşlem Hacmi', value: compact(volumeFor(stock)) },
      { label: 'Ort. Hacim', value: compact(stock.avgVolume) },
      { label: 'Piyasa Değeri', value: `${compact(stock.marketCap)} ₺`, wide: true },
      { label: 'RVol / Volatilite', value: `${stock.relVolume.toFixed(2)}x · ${formatPctValue(stock.volatility)}` },
      { label: "BIST'e Göre", value: formatPercent(relativePerformanceFor(stock)), tone: relativePerformanceFor(stock) >= 0 ? "gain" : "loss" },
      { label: 'Beta', value: stock.beta.toFixed(2) },
      { label: 'Hedef Potansiyeli', value: `${formatPercent(stock.targetSnapshot?.avgPotential || 0)} · ${formatPrice(stock.targetSnapshot?.avgTarget || priceFor(stock))}`, wide: true, tone: (stock.targetSnapshot?.avgPotential || 0) >= 0 ? 'gain' : 'loss' },
    ]);

    $('#drawerYearRangeText').textContent = `${formatPrice(stock.yearLow)} — ${formatPrice(stock.yearHigh)}`;
    $('#drawerYearRangeBar').style.width = `${clamp(stock.pricePosition, 1, 100)}%`;
    $('#drawerMetaInfo').innerHTML = `
      <div><strong>Veri kaynağı:</strong> ${state.sourceLabel}</div>
      <div><strong>Güncelleme:</strong> ${trDate.format(new Date(state.updatedAt))}</div>
      <div><strong>Durum:</strong> ${state.sourceMode === 'live' ? 'Gecikmeli canlı veri' : 'Demo / prototip verisi'}</div>
      <div><strong>Zaman Akışı:</strong> ${TIMELINE_STEPS[state.timelineIndex].label} (${TIMELINE_STEPS[state.timelineIndex].time})</div>`;

    const fkSectorAvg = sectorPeerAverage(stock, 'pe');
    const pbSectorAvg = sectorPeerAverage(stock, 'pb');
    renderSummaryChips('#fundamentalSummary', [
      { label: 'F/K vs Sektör', value: `${stock.fundamental.pe.toFixed(1)} / ${fkSectorAvg.toFixed(1)}`, tone: stock.fundamental.pe <= fkSectorAvg ? 'gain' : 'loss' },
      { label: 'PD/DD vs Sektör', value: `${stock.fundamental.pb.toFixed(2)} / ${pbSectorAvg.toFixed(2)}`, tone: stock.fundamental.pb <= pbSectorAvg ? 'gain' : 'loss' },
      { label: 'Temettü Verimi', value: formatPctValue(stock.fundamental.dividendYield), tone: 'gain' },
    ]);
    renderMetricGrid('#fundamentalGrid', [
      { label: 'F/K', value: stock.fundamental.pe.toFixed(1) },
      { label: 'PD/DD', value: stock.fundamental.pb.toFixed(2) },
      { label: 'FD/FAVÖK', value: stock.fundamental.evEbitda.toFixed(1) },
      { label: 'Özsermaye Karlılığı', value: formatPctValue(stock.fundamental.roe), tone: 'gain' },
      { label: 'Aktif Karlılığı', value: formatPctValue(stock.fundamental.roa) },
      { label: 'Temettü Verimi', value: formatPctValue(stock.fundamental.dividendYield), tone: 'gain' },
      { label: 'Brüt Kâr Marjı', value: formatPctValue(stock.fundamental.grossMargin) },
      { label: 'FAVÖK Marjı', value: formatPctValue(stock.fundamental.ebitdaMargin) },
      { label: 'Net Kâr Marjı', value: formatPctValue(stock.fundamental.netMargin) },
      { label: 'Halka Açıklık', value: formatPctValue(stock.fundamental.freeFloat) },
      { label: 'Net Borç / FAVÖK', value: stock.fundamental.debtEbitda.toFixed(2), tone: stock.fundamental.debtEbitda < 1.5 ? 'gain' : 'loss' },
      { label: 'Satış / Kâr Büyümesi', value: `${formatPctValue(stock.fundamental.salesGrowth)} · ${formatPctValue(stock.fundamental.profitGrowth)}`, wide: true },
    ]);

    renderSummaryChips('#technicalSummary', [
      { label: 'Trend', value: stock.technical.trendText, tone: stock.technical.trendScore >= 2 ? 'gain' : stock.technical.trendScore === 1 ? 'neutral' : 'loss' },
      { label: 'RSI(14)', value: stock.technical.rsi.toFixed(1), tone: stock.technical.rsi > 70 ? 'loss' : stock.technical.rsi < 30 ? 'gain' : 'neutral' },
      { label: 'MACD', value: stock.technical.signalText, tone: stock.technical.signalText.includes('AL') ? 'gain' : 'loss' },
      { label: 'Sinyal Dağılımı', value: `${stock.technical.buySignals} Al · ${stock.technical.neutralSignals} Nötr · ${stock.technical.sellSignals} Sat`, tone: 'neutral' },
    ]);
    renderMetricGrid('#technicalGrid', [
      { label: 'MA20', value: formatPrice(stock.technical.ma20), tone: current.price >= stock.technical.ma20 ? 'gain' : 'loss' },
      { label: 'MA50', value: formatPrice(stock.technical.ma50), tone: current.price >= stock.technical.ma50 ? 'gain' : 'loss' },
      { label: 'MA200', value: formatPrice(stock.technical.ma200), tone: current.price >= stock.technical.ma200 ? 'gain' : 'loss' },
      { label: 'EMA20', value: formatPrice(stock.technical.ema20) },
      { label: 'EMA50', value: formatPrice(stock.technical.ema50) },
      { label: 'RSI', value: stock.technical.rsi.toFixed(1), tone: stock.technical.rsi > 70 ? 'loss' : stock.technical.rsi < 30 ? 'gain' : 'neutral' },
      { label: 'MACD Histogram', value: trNumber.format(stock.technical.macdLine - stock.technical.signalLine), tone: stock.technical.macdLine >= stock.technical.signalLine ? 'gain' : 'loss' },
      { label: 'Stokastik', value: stock.technical.stoch.toFixed(1) },
      { label: 'ATR', value: formatPrice(stock.technical.atr) },
      { label: 'Bollinger Üst', value: formatPrice(stock.technical.bollUpper) },
      { label: 'Bollinger Alt', value: formatPrice(stock.technical.bollLower) },
      { label: '1H / 1A / 1Y', value: `${formatPercent(stock.weekPerf)} · ${formatPercent(stock.monthPerf)} · ${formatPercent(stock.yearPerf)}`, wide: true },
    ]);

    renderSummaryChips('#pivotSummary', [
      { label: 'Klasik', value: formatPrice(stock.pivots.classic.pivot) },
      { label: 'Fibonacci', value: formatPrice(stock.pivots.fibonacci.pivot) },
      { label: 'Camarilla', value: `${formatPrice(stock.pivots.camarilla.s3)} / ${formatPrice(stock.pivots.camarilla.r3)}` },
      { label: 'Woodie', value: formatPrice(stock.pivots.woodie.pivot) },
    ]);
    renderMetricGrid('#pivotGrid', [
      { label: 'Klasik Pivot', value: formatPrice(stock.pivots.classic.pivot) },
      { label: 'Klasik R1 / S1', value: `${formatPrice(stock.pivots.classic.r1)} · ${formatPrice(stock.pivots.classic.s1)}`, wide: true },
      { label: 'Klasik R2 / S2', value: `${formatPrice(stock.pivots.classic.r2)} · ${formatPrice(stock.pivots.classic.s2)}`, wide: true },
      { label: 'Fibo R1 / S1', value: `${formatPrice(stock.pivots.fibonacci.r1)} · ${formatPrice(stock.pivots.fibonacci.s1)}`, wide: true },
      { label: 'Fibo R2 / S2', value: `${formatPrice(stock.pivots.fibonacci.r2)} · ${formatPrice(stock.pivots.fibonacci.s2)}`, wide: true },
      { label: 'Camarilla R3 / S3', value: `${formatPrice(stock.pivots.camarilla.r3)} · ${formatPrice(stock.pivots.camarilla.s3)}`, wide: true },
      { label: 'Camarilla R4 / S4', value: `${formatPrice(stock.pivots.camarilla.r4)} · ${formatPrice(stock.pivots.camarilla.s4)}`, wide: true },
      { label: 'Woodie R1 / S1', value: `${formatPrice(stock.pivots.woodie.r1)} · ${formatPrice(stock.pivots.woodie.s1)}`, wide: true },
    ]);

    $('#newsList').innerHTML = stock.news.map((item) => `
      <article class="news-item">
        <div class="news-head">
          <span class="news-tag ${item.level}">${item.tag}</span>
          <span>${item.importance}</span>
        </div>
        <strong>${item.title}</strong>
        <p>${item.body}</p>
        <div class="news-meta"><span>${item.source}</span><span>${item.time}</span></div>
      </article>`).join('');

    $('#aiSummaryCard').innerHTML = `
      <h3>${stock.aiSummary.title}</h3>
      <p>${stock.aiSummary.paragraph}</p>
      <ul>${stock.aiSummary.bullets.map((bullet) => `<li>${bullet}</li>`).join('')}</ul>`;

    drawMiniChart(stock);
    loadTargetRecommendations(stock);
    syncDrawerButtons();
  }

  function activateDrawerTab(tab) {
    $$('.drawer-tab').forEach((button) => button.classList.toggle('active', button.dataset.tab === tab));
    $$('.drawer-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.panel === tab));
  }

  function openDrawer(stock) {
    renderDrawer(stock);
    activateDrawerTab('overview');
    $('#detailDrawer').classList.add('open');
    $('#detailDrawer').setAttribute('aria-hidden', 'false');
    document.body.classList.add('drawer-open');
    requestAnimationFrame(() => drawMiniChart(stock));
  }

  function closeDrawer() {
    $('#detailDrawer').classList.remove('open');
    $('#detailDrawer').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('drawer-open');
  }

  function drawMiniChart(stock) {
    const priceRect = miniChart.getBoundingClientRect();
    const volumeRect = volumeChart.getBoundingClientRect();
    if (!priceRect.width || !priceRect.height || !volumeRect.width || !volumeRect.height) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    miniChart.width = Math.max(1, Math.round(priceRect.width * dpr));
    miniChart.height = Math.max(1, Math.round(priceRect.height * dpr));
    volumeChart.width = Math.max(1, Math.round(volumeRect.width * dpr));
    volumeChart.height = Math.max(1, Math.round(volumeRect.height * dpr));
    miniCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    volumeCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    miniCtx.clearRect(0, 0, priceRect.width, priceRect.height);
    volumeCtx.clearRect(0, 0, volumeRect.width, volumeRect.height);

    const { values, volumes, config } = chartSeriesFor(stock);
    $('#chartPeriodLabel').textContent = config.label;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = { top: 18, right: 14, bottom: 18, left: 14 };
    const innerW = priceRect.width - padding.left - padding.right;
    const innerH = priceRect.height - padding.top - padding.bottom;
    const stepX = innerW / Math.max(values.length - 1, 1);
    const toX = (index) => padding.left + stepX * index;
    const toY = (value) => padding.top + (1 - ((value - min) / Math.max(.0001, max - min))) * innerH;
    const ma = values.map((_, idx) => average(values.slice(Math.max(0, idx - Math.max(4, Math.round(values.length / 12))), idx + 1)));

    miniCtx.strokeStyle = 'rgba(255,255,255,.075)';
    miniCtx.lineWidth = 1;
    [0, .25, .5, .75, 1].forEach((ratio) => {
      const y = padding.top + innerH * ratio;
      miniCtx.beginPath(); miniCtx.moveTo(padding.left, y); miniCtx.lineTo(priceRect.width - padding.right, y); miniCtx.stroke();
    });

    const gradient = miniCtx.createLinearGradient(0, padding.top, 0, priceRect.height - padding.bottom);
    gradient.addColorStop(0, changeFor(stock) >= 0 ? 'rgba(39,228,154,.30)' : 'rgba(255,93,125,.24)');
    gradient.addColorStop(1, 'rgba(39,228,154,0)');
    miniCtx.beginPath();
    values.forEach((value, index) => index ? miniCtx.lineTo(toX(index), toY(value)) : miniCtx.moveTo(toX(index), toY(value)));
    miniCtx.lineTo(toX(values.length - 1), priceRect.height - padding.bottom);
    miniCtx.lineTo(toX(0), priceRect.height - padding.bottom);
    miniCtx.closePath(); miniCtx.fillStyle = gradient; miniCtx.fill();

    miniCtx.beginPath();
    ma.forEach((value, index) => index ? miniCtx.lineTo(toX(index), toY(value)) : miniCtx.moveTo(toX(index), toY(value)));
    miniCtx.strokeStyle = 'rgba(255,255,255,.34)'; miniCtx.lineWidth = 1.3; miniCtx.stroke();

    miniCtx.beginPath();
    values.forEach((value, index) => index ? miniCtx.lineTo(toX(index), toY(value)) : miniCtx.moveTo(toX(index), toY(value)));
    miniCtx.lineWidth = 2.35;
    miniCtx.strokeStyle = changeFor(stock) >= 0 ? '#27e49a' : '#ff5d7d';
    miniCtx.shadowColor = changeFor(stock) >= 0 ? 'rgba(39,228,154,.42)' : 'rgba(255,93,125,.34)';
    miniCtx.shadowBlur = 9; miniCtx.stroke(); miniCtx.shadowBlur = 0;

    const lastX = toX(values.length - 1); const lastY = toY(values[values.length - 1]);
    miniCtx.beginPath(); miniCtx.arc(lastX, lastY, 3.6, 0, Math.PI * 2); miniCtx.fillStyle = changeFor(stock) >= 0 ? '#27e49a' : '#ff5d7d'; miniCtx.fill();
    miniCtx.fillStyle = 'rgba(205,225,215,.72)'; miniCtx.font = '600 9px Inter, sans-serif';
    miniCtx.textAlign = 'left'; miniCtx.fillText(formatPrice(min), padding.left, priceRect.height - 4);
    miniCtx.textAlign = 'right'; miniCtx.fillText(formatPrice(max), priceRect.width - padding.right, 10);

    const maxVolume = Math.max(...volumes, 1);
    const barGap = 1;
    const barWidth = Math.max(1, volumeRect.width / volumes.length - barGap);
    volumes.forEach((volume, index) => {
      const height = (volume / maxVolume) * (volumeRect.height - 15);
      const x = index * (barWidth + barGap);
      const up = index === 0 || values[index] >= values[index - 1];
      volumeCtx.fillStyle = up ? 'rgba(39,228,154,.48)' : 'rgba(255,93,125,.44)';
      volumeCtx.fillRect(x, volumeRect.height - height - 2, barWidth, height);
    });
    volumeCtx.fillStyle = 'rgba(180,205,193,.65)'; volumeCtx.font = '600 8px Inter, sans-serif'; volumeCtx.textAlign = 'left';
    volumeCtx.fillText(`Hacim ${compact(volumeFor(stock))}`, 3, 9);
  }

  function switchView(view) {
    state.view = view;
    $('#bubblePanel').hidden = view !== 'bubble';
    $('#listPanel').hidden = view !== 'list';
    $('#bubbleViewBtn').classList.toggle('active', view === 'bubble');
    $('#listViewBtn').classList.toggle('active', view === 'list');
    if (view === 'bubble') requestAnimationFrame(resizeCanvas);
  }

  function switchScreen(screen) {
    state.activeScreen = screen;
    $$('.screen-btn').forEach((button) => button.classList.toggle('active', button.dataset.screen === screen));
    $$('.screen').forEach((panel) => panel.classList.toggle('active', panel.id === `screen-${screen}`));
    if (screen === 'market') requestAnimationFrame(resizeCanvas);
  }

  function stopTimelinePlay() {
    clearInterval(state.playTimer);
    state.playing = false;
    $('#timelinePlayBtn').innerHTML = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
  }

  function updateTimelineControls() {
    const step = TIMELINE_STEPS[state.timelineIndex];
    $('#timelineRange').value = String(state.timelineIndex);
    $('#timelineLabel').textContent = step.label;
    $('#timelineClock').textContent = step.time;
  }

  function setTimelineIndex(index) {
    state.timelineIndex = clamp(Number(index), 0, TIMELINE_STEPS.length - 1);
    updateTimelineControls();
    applyFilters(true);
  }

  function playTimeline() {
    if (state.playing) { stopTimelinePlay(); return; }
    state.playing = true;
    $('#timelinePlayBtn').innerHTML = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';
    state.playTimer = setInterval(() => {
      const next = state.timelineIndex >= TIMELINE_STEPS.length - 1 ? 0 : state.timelineIndex + 1;
      setTimelineIndex(next);
      if (next === TIMELINE_STEPS.length - 1) {
        setTimeout(stopTimelinePlay, 650);
      }
    }, 900);
  }

  async function loadData(period = state.period, force = false) {
    state.period = period;
    loadingState.hidden = false;
    loadingState.style.display = '';
    if (window.BIST_STATIC_MODE) {
      const payload = createLocalDemoPayload(period);
      payload.sourceLabel = 'Sunum verisi · GitHub Pages statik sürüm';
      state.sourceLabel = payload.sourceLabel;
      state.updatedAt = payload.updatedAt;
      state.sourceMode = payload.mode;
      state.rawStocks = buildEnrichedStocks(payload.stocks || []);
      populateSectors();
      updateTimelineControls();
      applyFilters(false);
      renderScannerGroups();
      loadingState.hidden = true;
      loadingState.style.display = 'none';
      return;
    }
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const response = await fetch(`/api/market?period=${encodeURIComponent(period)}${force ? `&_=${Date.now()}` : ''}`, {
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      state.sourceLabel = payload.sourceLabel || 'Veri';
      state.updatedAt = payload.updatedAt || new Date().toISOString();
      state.sourceMode = payload.mode || 'live';
      state.rawStocks = buildEnrichedStocks(payload.stocks || []);
    } catch (error) {
      console.warn('API kullanılamadı, demo veriye geçiliyor.', error);
      const payload = createLocalDemoPayload(period);
      state.sourceLabel = payload.sourceLabel;
      state.updatedAt = payload.updatedAt;
      state.sourceMode = payload.mode;
      state.rawStocks = buildEnrichedStocks(payload.stocks || []);
    } finally {
      populateSectors();
      updateTimelineControls();
      applyFilters(false);
      renderScannerGroups();
      loadingState.hidden = true;
      loadingState.style.display = 'none';
    }
  }

  canvas.addEventListener('pointermove', (event) => {
    const { x, y } = pointerPosition(event);
    if (state.dragging) {
      state.dragging.x = x - state.dragOffsetX;
      state.dragging.y = y - state.dragOffsetY;
      state.dragging.vx = 0;
      state.dragging.vy = 0;
      tooltip.hidden = true;
      return;
    }
    state.hovered = nodeAt(x, y);
    canvas.style.cursor = state.hovered ? 'pointer' : 'grab';
    showTooltip(state.hovered, x, y);
  });
  canvas.addEventListener('pointerdown', (event) => {
    const { x, y } = pointerPosition(event);
    const node = nodeAt(x, y);
    if (!node) return;
    state.dragging = node;
    state.dragOffsetX = x - node.x;
    state.dragOffsetY = y - node.y;
    state.dragStartX = x;
    state.dragStartY = y;
    canvas.classList.add('dragging');
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointerup', (event) => {
    if (!state.dragging) return;
    const dragged = state.dragging;
    const { x, y } = pointerPosition(event);
    const moved = Math.hypot(x - state.dragStartX, y - state.dragStartY);
    state.dragging = null;
    canvas.classList.remove('dragging');
    if (moved < 8) openDrawer(dragged.stock);
  });
  canvas.addEventListener('pointercancel', () => { state.dragging = null; canvas.classList.remove('dragging'); });
  canvas.addEventListener('pointerleave', () => { if (!state.dragging) { state.hovered = null; tooltip.hidden = true; } });
  canvas.addEventListener('dblclick', () => rebuildNodes(false));

  $('#searchInput').addEventListener('input', (event) => { state.query = event.target.value; applyFilters(); });
  $('#sectorSelect').addEventListener('change', (event) => { state.sector = event.target.value; applyFilters(); });
  $('#indexSelect').addEventListener('change', (event) => { state.limit = Number(event.target.value); populateSectors(); applyFilters(false); });
  $('#quickFilter').addEventListener('change', (event) => { state.quickFilter = event.target.value; applyFilters(false); });
  $('#sizeMetric').addEventListener('change', (event) => { state.sizeMetric = event.target.value; rebuildNodes(true); });
  $('#bubbleInfo').addEventListener('change', (event) => { state.bubbleInfo = event.target.value; });
  $('#clusterToggle').addEventListener('click', () => {
    state.clusterMode = !state.clusterMode;
    $('#clusterToggle').classList.toggle('active', state.clusterMode);
    $('#clusterToggle').textContent = `Sektörel Kümelenme: ${state.clusterMode ? 'Açık' : 'Kapalı'}`;
    updateNodeTargets();
  });
  $('#refreshBtn').addEventListener('click', () => loadData(state.period, true));
  $('#resetLayoutBtn').addEventListener('click', () => rebuildNodes(false));
  $('#bubbleViewBtn').addEventListener('click', () => switchView('bubble'));
  $('#listViewBtn').addEventListener('click', () => switchView('list'));
  $('#sortChangeBtn').addEventListener('click', () => { state.sortDescending = !state.sortDescending; renderListTable(); });
  $('#fullscreenBtn').addEventListener('click', async () => {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
    else await document.exitFullscreen?.();
  });
  $('#themeBtn').addEventListener('click', () => {
    document.documentElement.classList.toggle('light');
    try { localStorage.setItem(STORAGE.theme, document.documentElement.classList.contains('light') ? 'light' : 'dark'); } catch {}
  });
  $('#timelineRange').addEventListener('input', (event) => setTimelineIndex(event.target.value));
  $('#timelinePlayBtn').addEventListener('click', playTimeline);
  $$('.periods button').forEach((button) => button.addEventListener('click', () => {
    $$('.periods button').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    loadData(button.dataset.period);
  }));
  $$('.screen-btn').forEach((button) => button.addEventListener('click', () => switchScreen(button.dataset.screen)));
  $$('[data-close-drawer]').forEach((item) => item.addEventListener('click', closeDrawer));
  $$('.drawer-tab').forEach((button) => button.addEventListener('click', () => activateDrawerTab(button.dataset.tab)));
  $$('.chart-periods button').forEach((button) => button.addEventListener('click', () => {
    state.drawerChartPeriod = button.dataset.chartPeriod;
    $$('.chart-periods button').forEach((item) => item.classList.toggle('active', item === button));
    if (state.selected) drawMiniChart(state.selected);
  }));
  $('#drawerFavoriteBtn').addEventListener('click', () => state.selected && toggleFavorite(state.selected.symbol));
  $('#drawerCompareBtn').addEventListener('click', () => state.selected && toggleCompare(state.selected.symbol));
  $('#drawerPortfolioBtn').addEventListener('click', () => state.selected && togglePortfolioSymbol(state.selected));
  $('#drawerAlertBtn').addEventListener('click', () => state.selected && addAlertFor(state.selected));

  $('#sectorHeatList').addEventListener('click', (event) => {
    const button = event.target.closest('[data-sector]');
    if (!button) return;
    state.sector = button.dataset.sector;
    $('#sectorSelect').value = button.dataset.sector;
    applyFilters();
  });
  $('#favoritesList').addEventListener('click', (event) => {
    const card = event.target.closest('[data-symbol]');
    if (!card) return;
    const stock = activeUniverse().find((item) => item.symbol === card.dataset.symbol);
    if (stock) openDrawer(stock);
  });
  $('#alertsList').addEventListener('click', (event) => {
    const id = event.target.getAttribute('data-remove-alert');
    if (id) removeAlert(id);
  });
  $('#stockTableBody').addEventListener('click', (event) => {
    const action = event.target.closest('[data-action]');
    if (action) {
      event.stopPropagation();
      const stock = activeUniverse().find((item) => item.symbol === action.dataset.symbol);
      if (!stock) return;
      if (action.dataset.action === 'favorite') toggleFavorite(stock.symbol);
      if (action.dataset.action === 'compare') toggleCompare(stock.symbol);
      renderListTable();
      return;
    }
    const row = event.target.closest('tr[data-symbol]');
    if (!row) return;
    const stock = activeUniverse().find((item) => item.symbol === row.dataset.symbol);
    if (stock) openDrawer(stock);
  });
  $('#scannerGroups').addEventListener('click', (event) => {
    const button = event.target.closest('[data-scan]');
    if (!button) return;
    state.activeScan = button.dataset.scan;
    renderScannerGroups();
    renderScannerResults();
  });
  $('#scannerTableBody').addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-symbol]');
    if (!row) return;
    const stock = activeUniverse().find((item) => item.symbol === row.dataset.symbol);
    if (stock) openDrawer(stock);
  });
  $('#compareSelection').addEventListener('click', (event) => {
    const symbol = event.target.getAttribute('data-remove-compare');
    if (symbol) toggleCompare(symbol);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { closeDrawer(); stopTimelinePlay(); }
    if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
      event.preventDefault();
      $('#searchInput').focus();
    }
  });
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resizeCanvas, 90);
  });
  document.addEventListener('fullscreenchange', resizeCanvas);

  try { if (localStorage.getItem(STORAGE.theme) === 'light') document.documentElement.classList.add('light'); } catch {}
  updateMarketStatus();
  setInterval(updateMarketStatus, 60_000);
  resizeCanvas();
  animate();
  loadData();
  setInterval(() => loadData(state.period, true), 120_000);
})();
