# frontend/public/ Assets

静态资源，由 Vite 直接拷贝到构建产物根目录。

## SVG 源文件 → 栅格化派生品

`favicon.svg` 与 `og-image.svg` 是 SSOT。下列 PNG / ICO 是**派生**产物，需要时用 ImageMagick 7 (`magick`) 在本地重新生成（不要手动 PS）。

```bash
# 1. favicon.ico — 16/32/48 multi-size
magick favicon.svg -define icon:auto-resize=16,32,48 favicon.ico

# 2. apple-touch-icon.png — iOS 主屏 180×180
magick -background none -density 600 favicon.svg -resize 180x180 apple-touch-icon.png

# 3. PWA 标准图标
magick -background none -density 600 favicon.svg -resize 192x192 icon-192.png
magick -background none -density 600 favicon.svg -resize 512x512 icon-512.png

# 4. PWA maskable 图标 — 80% safe area，外圈用 ink 底色填充
magick -background "#0b1120" -density 600 favicon.svg \
  -resize 410x410 -gravity center -extent 512x512 icon-maskable-512.png

# 5. og-image.png — 1200×630，社交分享卡片（Twitter / WeChat / Telegram）
magick -background white -density 200 og-image.svg og-image.png
```

## 约定

- 改 SVG 源文件后必须重跑上面对应的命令更新 PNG/ICO，不要让派生品和源文件分叉。
- 所有视觉规范（色值 / 字体）见 `frontend/src/styles/tokens.css`。
- 不要新增背景渐变或多色 logo —— ink-first 风格只允许主色 `#0b1120` + accent `#3f7ef1` 点缀。
