"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, FileDown, ImagePlus, Palette, Type } from "lucide-react";
import type { GeneratorConfig } from "@/lib/generators";
import type { AgencyClient } from "@/lib/agency";
import { allTemplates, saveCustomTemplate, type SectorTemplate } from "@/lib/templates";
import {
  buildVisualText,
  visualFileName,
  visualFormats,
  visualStyles,
  type VisualFormat,
  type VisualStyle,
  type VisualText
} from "@/lib/visuals";
import { saveVisualRecord } from "@/lib/visual-history";
import { getAuthHeaders, isSupabaseBrowserConfigured } from "@/lib/supabase-client";

type VisualCreatorProps = {
  generator: GeneratorConfig;
  values: Record<string, string>;
  output: string;
  client?: AgencyClient | null;
};

export function VisualCreator({ generator, values, output, client }: VisualCreatorProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [format, setFormat] = useState<VisualFormat>("square");
  const [style, setStyle] = useState<VisualStyle>("premium");
  const [primaryColor, setPrimaryColor] = useState("#FF6B00");
  const [secondaryColor, setSecondaryColor] = useState("#FFFFFF");
  const [logo, setLogo] = useState("");
  const [background, setBackground] = useState("");
  const [text, setText] = useState<VisualText>(() => buildVisualText(generator, values, output));
  const [templates, setTemplates] = useState<SectorTemplate[]>([]);
  const [templateId, setTemplateId] = useState("");
  const dimensions = visualFormats[format];
  const isStory = format === "story";
  const isBanner = format === "banner";
  const safeId = `visual-${generator.id}-${format}`;

  useEffect(() => {
    setText(buildVisualText(generator, values, output));
  }, [generator, values, output]);

  useEffect(() => {
    const list = allTemplates();
    setTemplates(list);
    const match = list.find((template) => template.sector === client?.sector) || list[0];
    if (match) applyTemplate(match);
    if (client) {
      setPrimaryColor(client.primaryColor);
      setSecondaryColor(client.secondaryColor);
      setLogo(client.logo);
    }
  }, [client]);

  const layout = useMemo(() => {
    const width = dimensions.width;
    const height = dimensions.height;
    const margin = isStory ? 92 : isBanner ? 82 : 78;
    const logoSize = isBanner ? 96 : isStory ? 144 : 118;
    const kickerY = isStory ? 470 : isBanner ? 164 : 286;
    const headlineY = isStory ? 620 : isBanner ? 276 : 430;
    const subY = isStory ? 880 : isBanner ? 392 : 620;
    const footerY = isStory ? 1515 : isBanner ? 504 : 880;
    const headlineSize = isBanner ? 86 : isStory ? 118 : 104;

    return { width, height, margin, logoSize, kickerY, headlineY, subY, footerY, headlineSize };
  }, [dimensions, isBanner, isStory]);

  async function handleUpload(file: File | undefined, setter: (value: string) => void) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setter(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  async function downloadPng() {
    rememberVisual();
    const canvas = await renderSvgToCanvas(svgRef.current, dimensions.width, dimensions.height);
    downloadBlob(await canvasToBlob(canvas, "image/png"), visualFileName(generator.id, format, "png", client?.name));
  }

  async function downloadPdf() {
    rememberVisual();
    const canvas = await renderSvgToCanvas(svgRef.current, dimensions.width, dimensions.height);
    const jpegDataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const pdf = buildImagePdf(jpegDataUrl, dimensions.width, dimensions.height);
    downloadBlob(pdf, visualFileName(generator.id, format, "pdf", client?.name));
  }

  function applyTemplate(template: SectorTemplate) {
    setTemplateId(template.id);
    setStyle(template.style);
    setPrimaryColor(client?.primaryColor || template.primaryColor);
    setSecondaryColor(client?.secondaryColor || template.secondaryColor);
    setText({
      kicker: template.kicker,
      headline: template.headline,
      subheadline: template.subheadline,
      footer: template.footer
    });
  }

  function duplicateTemplate() {
    const current = templates.find((template) => template.id === templateId);
    if (!current) return;
    const copy: SectorTemplate = {
      ...current,
      id: `${current.id}-copy-${Date.now()}`,
      name: `${current.name} copie`,
      primaryColor,
      secondaryColor,
      style,
      kicker: text.kicker,
      headline: text.headline,
      subheadline: text.subheadline,
      footer: text.footer
    };
    const custom = saveCustomTemplate(copy);
    setTemplates([...templates.filter((template) => template.id !== copy.id), ...custom]);
    setTemplateId(copy.id);
  }

  function rememberVisual() {
    if (!svgRef.current) return;
    const record = {
      id: crypto.randomUUID(),
      title: `${generator.title} - ${visualFormats[format].label}`,
      format,
      width: dimensions.width,
      height: dimensions.height,
      svg: new XMLSerializer().serializeToString(svgRef.current),
      createdAt: new Date().toISOString()
    };

    if (!isSupabaseBrowserConfigured()) {
      saveVisualRecord(record);
      return;
    }

    fetch("/api/visuals", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify(record)
    }).catch(() => saveVisualRecord(record));
  }

  return (
    <section className="surface premium-border rounded-lg p-5 shadow-premium">
      <div className="mb-5 flex flex-col gap-3 border-b border-white/10 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black uppercase tracking-[0.24em] text-noline-orange">
            Createur de visuels
          </p>
          <h2 className="mt-2 text-2xl font-black text-white">Template pret a publier</h2>
          <p className="mt-2 text-sm text-noline-muted">
            Modifiez le template, importez vos assets et exportez en PNG/PDF par format reseau.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadPng}
            className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-black text-noline-black transition hover:bg-noline-orange"
          >
            <Download className="h-4 w-4" />
            PNG
          </button>
          <button
            type="button"
            onClick={downloadPdf}
            className="inline-flex items-center gap-2 rounded-md border border-white/12 px-4 py-2 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
          >
            <FileDown className="h-4 w-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[24rem_1fr]">
        <div className="space-y-4">
          <ControlGroup title="Format" icon={ImagePlus}>
            <div className="grid gap-2">
              {(Object.keys(visualFormats) as VisualFormat[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFormat(item)}
                  className={`rounded-md border px-3 py-2 text-left text-sm font-bold transition ${
                    format === item
                      ? "border-noline-orange bg-noline-orange text-noline-black"
                      : "border-white/10 bg-noline-black text-white hover:border-white/30"
                  }`}
                >
                  {visualFormats[item].label}
                </button>
              ))}
            </div>
          </ControlGroup>

          <ControlGroup title="Bibliotheque" icon={Palette}>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-noline-muted">
                Template secteur
              </span>
              <select
                value={templateId}
                onChange={(event) => {
                  const template = templates.find((item) => item.id === event.target.value);
                  if (template) applyTemplate(template);
                }}
                className="w-full rounded-md border border-white/10 bg-noline-black px-3 py-2 text-sm text-white outline-none focus:border-noline-orange"
              >
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name} - {template.sector}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={duplicateTemplate}
              className="w-full rounded-md border border-white/12 px-3 py-2 text-sm font-black text-white transition hover:bg-white hover:text-noline-black"
            >
              Dupliquer le template
            </button>
          </ControlGroup>

          <ControlGroup title="Template" icon={Palette}>
            <label className="block">
              <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-noline-muted">
                Style
              </span>
              <select
                value={style}
                onChange={(event) => setStyle(event.target.value as VisualStyle)}
                className="w-full rounded-md border border-white/10 bg-noline-black px-3 py-2 text-sm text-white outline-none focus:border-noline-orange"
              >
                {visualStyles.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <ColorPicker label="Primaire" value={primaryColor} onChange={setPrimaryColor} />
              <ColorPicker label="Secondaire" value={secondaryColor} onChange={setSecondaryColor} />
            </div>
          </ControlGroup>

          <ControlGroup title="Assets" icon={ImagePlus}>
            <FilePicker label="Logo client" onChange={(file) => handleUpload(file, setLogo)} />
            <FilePicker label="Photo de fond" onChange={(file) => handleUpload(file, setBackground)} />
          </ControlGroup>

          <ControlGroup title="Textes du visuel" icon={Type}>
            <TemplateTextField label="Accroche" value={text.kicker} onChange={(value) => setText((current) => ({ ...current, kicker: value }))} />
            <TemplateTextField label="Titre" value={text.headline} onChange={(value) => setText((current) => ({ ...current, headline: value }))} />
            <TemplateTextField label="Sous-titre" value={text.subheadline} onChange={(value) => setText((current) => ({ ...current, subheadline: value }))} />
            <TemplateTextField label="Bas de visuel" value={text.footer} onChange={(value) => setText((current) => ({ ...current, footer: value }))} multiline />
          </ControlGroup>
        </div>

        <div className="rounded-lg border border-white/10 bg-noline-black p-4">
          <div className="mx-auto max-h-[46rem] w-full overflow-auto">
            <svg
              ref={svgRef}
              xmlns="http://www.w3.org/2000/svg"
              viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
              width={dimensions.width}
              height={dimensions.height}
              className="mx-auto h-auto max-h-[44rem] w-auto max-w-full rounded-md bg-black"
            >
              <defs>
                <linearGradient id={`${safeId}-gradient`} x1="0" x2="1" y1="0" y2="1">
                  <stop offset="0%" stopColor={primaryColor} stopOpacity={style === "minimaliste" ? 0.16 : 0.7} />
                  <stop offset="48%" stopColor="#111111" stopOpacity="0.92" />
                  <stop offset="100%" stopColor={style === "sportif" ? primaryColor : "#111111"} stopOpacity="1" />
                </linearGradient>
                <clipPath id={`${safeId}-clip`}>
                  <rect x="0" y="0" width={dimensions.width} height={dimensions.height} rx="0" />
                </clipPath>
                <filter id={`${safeId}-shadow`} x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="18" stdDeviation="18" floodColor="#000000" floodOpacity="0.42" />
                </filter>
              </defs>

              <rect width={dimensions.width} height={dimensions.height} fill="#111111" />
              {background ? (
                <image
                  href={background}
                  x="0"
                  y="0"
                  width={dimensions.width}
                  height={dimensions.height}
                  preserveAspectRatio="xMidYMid slice"
                  opacity={style === "minimaliste" ? 0.34 : 0.56}
                  clipPath={`url(#${safeId}-clip)`}
                />
              ) : (
                <BackgroundPattern width={dimensions.width} height={dimensions.height} color={primaryColor} styleName={style} />
              )}
              <rect width={dimensions.width} height={dimensions.height} fill={`url(#${safeId}-gradient)`} />

              {style !== "minimaliste" ? (
                <>
                  <rect
                    x={layout.margin}
                    y={layout.margin}
                    width={dimensions.width - layout.margin * 2}
                    height={dimensions.height - layout.margin * 2}
                    fill="none"
                    stroke={secondaryColor}
                    strokeOpacity="0.26"
                    strokeWidth="3"
                  />
                  <rect
                    x={layout.margin + 18}
                    y={layout.margin + 18}
                    width={dimensions.width - (layout.margin + 18) * 2}
                    height={dimensions.height - (layout.margin + 18) * 2}
                    fill="none"
                    stroke={primaryColor}
                    strokeOpacity="0.48"
                    strokeWidth="5"
                  />
                </>
              ) : null}

              <text
                x={layout.margin}
                y={layout.kickerY}
                fill={primaryColor}
                fontFamily="Arial, Helvetica, sans-serif"
                fontWeight="900"
                fontSize={isBanner ? 34 : 42}
                letterSpacing="8"
              >
                {text.kicker.toUpperCase()}
              </text>

              <WrappedText
                x={layout.margin}
                y={layout.headlineY}
                maxWidth={dimensions.width - layout.margin * 2}
                text={text.headline.toUpperCase()}
                fill={secondaryColor}
                fontSize={layout.headlineSize}
                lineHeight={layout.headlineSize * 0.92}
                weight="900"
                maxLines={isBanner ? 2 : 3}
              />

              <WrappedText
                x={layout.margin}
                y={layout.subY}
                maxWidth={dimensions.width - layout.margin * 2}
                text={text.subheadline}
                fill="#FFFFFF"
                fontSize={isBanner ? 38 : 48}
                lineHeight={isBanner ? 46 : 58}
                weight="700"
                maxLines={2}
              />

              <g filter={`url(#${safeId}-shadow)`}>
                <rect
                  x={layout.margin}
                  y={layout.footerY - 56}
                  width={dimensions.width - layout.margin * 2}
                  height={isBanner ? 96 : 132}
                  fill="#111111"
                  opacity="0.78"
                />
                <WrappedText
                  x={layout.margin + 28}
                  y={layout.footerY}
                  maxWidth={dimensions.width - layout.margin * 2 - 56}
                  text={text.footer}
                  fill="#FFFFFF"
                  fontSize={isBanner ? 28 : 34}
                  lineHeight={isBanner ? 34 : 42}
                  weight="700"
                  maxLines={isBanner ? 2 : 3}
                />
              </g>

              <g transform={`translate(${dimensions.width - layout.margin - layout.logoSize}, ${layout.margin})`}>
                <rect width={layout.logoSize} height={layout.logoSize} fill="#FFFFFF" opacity="0.96" />
                {logo ? (
                  <image
                    href={logo}
                    x={layout.logoSize * 0.12}
                    y={layout.logoSize * 0.12}
                    width={layout.logoSize * 0.76}
                    height={layout.logoSize * 0.76}
                    preserveAspectRatio="xMidYMid meet"
                  />
                ) : (
                  <text
                    x={layout.logoSize / 2}
                    y={layout.logoSize / 2 + 9}
                    textAnchor="middle"
                    fill="#111111"
                    fontFamily="Arial, Helvetica, sans-serif"
                    fontWeight="900"
                    fontSize={layout.logoSize * 0.18}
                  >
                    LOGO
                  </text>
                )}
              </g>

              <text
                x={layout.margin}
                y={dimensions.height - layout.margin * 0.55}
                fill="#FFFFFF"
                fontFamily="Arial, Helvetica, sans-serif"
                fontWeight="900"
                fontSize={isBanner ? 24 : 28}
                opacity="0.72"
              >
                NOLINE STUDIO
              </text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

function ControlGroup({
  title,
  icon: Icon,
  children
}: {
  title: string;
  icon: typeof Palette;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-white/10 bg-noline-black p-4">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-noline-orange" />
        <h3 className="text-sm font-black text-white">{title}</h3>
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ColorPicker({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-noline-muted">
        {label}
      </span>
      <span className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-8 w-10 cursor-pointer border-0 bg-transparent p-0"
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-w-0 flex-1 bg-transparent text-xs font-bold text-white outline-none"
        />
      </span>
    </label>
  );
}

function FilePicker({ label, onChange }: { label: string; onChange: (file: File | undefined) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-noline-muted">
        {label}
      </span>
      <input
        type="file"
        accept="image/*"
        onChange={(event) => onChange(event.target.files?.[0])}
        className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs text-white file:mr-3 file:rounded-md file:border-0 file:bg-noline-orange file:px-3 file:py-2 file:text-xs file:font-black file:text-noline-black"
      />
    </label>
  );
}

function TemplateTextField({
  label,
  value,
  onChange,
  multiline = false
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-bold uppercase tracking-[0.16em] text-noline-muted">
        {label}
      </span>
      {multiline ? (
        <textarea
          value={value}
          rows={3}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-noline-orange"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none focus:border-noline-orange"
        />
      )}
    </label>
  );
}

function BackgroundPattern({
  width,
  height,
  color,
  styleName
}: {
  width: number;
  height: number;
  color: string;
  styleName: VisualStyle;
}) {
  if (styleName === "minimaliste") {
    return <rect width={width} height={height} fill="#151515" />;
  }

  return (
    <g opacity={styleName === "sportif" ? 0.38 : 0.28}>
      <circle cx={width * 0.18} cy={height * 0.22} r={Math.min(width, height) * 0.22} fill={color} />
      <circle cx={width * 0.88} cy={height * 0.85} r={Math.min(width, height) * 0.28} fill={color} />
      {styleName === "sportif" || styleName === "evenementiel" ? (
        <g stroke="#FFFFFF" strokeOpacity="0.24" strokeWidth="4">
          <path d={`M ${width * 0.08} ${height * 0.8} L ${width * 0.82} ${height * 0.1}`} />
          <path d={`M ${width * 0.2} ${height * 0.95} L ${width * 0.95} ${height * 0.25}`} />
          <path d={`M ${width * 0.02} ${height * 0.46} L ${width * 0.45} ${height * 0.04}`} />
        </g>
      ) : null}
    </g>
  );
}

function WrappedText({
  x,
  y,
  maxWidth,
  text,
  fill,
  fontSize,
  lineHeight,
  weight,
  maxLines
}: {
  x: number;
  y: number;
  maxWidth: number;
  text: string;
  fill: string;
  fontSize: number;
  lineHeight: number;
  weight: string;
  maxLines: number;
}) {
  const lines = wrapText(text, maxWidth, fontSize, maxLines);

  return (
    <text
      x={x}
      y={y}
      fill={fill}
      fontFamily="Arial, Helvetica, sans-serif"
      fontWeight={weight}
      fontSize={fontSize}
    >
      {lines.map((line, index) => (
        <tspan key={`${line}-${index}`} x={x} dy={index === 0 ? 0 : lineHeight}>
          {line}
        </tspan>
      ))}
    </text>
  );
}

function wrapText(text: string, maxWidth: number, fontSize: number, maxLines: number) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  const approxCharWidth = fontSize * 0.56;
  const maxChars = Math.max(8, Math.floor(maxWidth / approxCharWidth));

  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length > maxChars && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });

  if (line) lines.push(line);
  const limited = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    limited[maxLines - 1] = `${limited[maxLines - 1].replace(/\.+$/, "")}...`;
  }
  return limited.length ? limited : [""];
}

async function renderSvgToCanvas(svg: SVGSVGElement | null, width: number, height: number) {
  if (!svg) throw new Error("Aucun visuel a exporter.");
  const serialized = new XMLSerializer().serializeToString(svg);
  const blob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = await loadImage(url);
  URL.revokeObjectURL(url);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Export canvas indisponible.");
  context.fillStyle = "#111111";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas;
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Export impossible."));
    }, type);
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function buildImagePdf(jpegDataUrl: string, width: number, height: number) {
  const jpegBytes = base64ToBytes(jpegDataUrl.split(",")[1] || "");
  const pageWidth = 595.28;
  const pageHeight = pageWidth * (height / width);
  const objects: Array<string | Uint8Array> = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(
      2
    )}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>`,
    concatPdfBytes(
      `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
      jpegBytes,
      "\nendstream"
    ),
    buildContentStream(
      `q\n${pageWidth.toFixed(2)} 0 0 ${pageHeight.toFixed(2)} 0 0 cm\n/Im0 Do\nQ`
    )
  ];

  return new Blob([buildPdf(objects)], { type: "application/pdf" });
}

function buildPdf(objects: Array<string | Uint8Array>) {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [encoder.encode("%PDF-1.4\n")];
  const offsets: number[] = [];
  let length = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(length);
    const prefix = encoder.encode(`${index + 1} 0 obj\n`);
    const body = typeof object === "string" ? encoder.encode(object) : object;
    const suffix = encoder.encode("\nendobj\n");
    chunks.push(prefix, body, suffix);
    length += prefix.length + body.length + suffix.length;
  });

  const xrefOffset = length;
  const xref = [
    "xref",
    `0 ${objects.length + 1}`,
    "0000000000 65535 f ",
    ...offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
    "trailer",
    `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    "startxref",
    String(xrefOffset),
    "%%EOF"
  ].join("\n");
  chunks.push(encoder.encode(xref));

  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(total);
  let cursor = 0;
  chunks.forEach((chunk) => {
    result.set(chunk, cursor);
    cursor += chunk.length;
  });
  return result;
}

function concatPdfBytes(prefix: string, bytes: Uint8Array, suffix: string) {
  const encoder = new TextEncoder();
  const start = encoder.encode(prefix);
  const end = encoder.encode(suffix);
  const result = new Uint8Array(start.length + bytes.length + end.length);
  result.set(start, 0);
  result.set(bytes, start.length);
  result.set(end, start.length + bytes.length);
  return result;
}

function buildContentStream(content: string) {
  return `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n${content}\nendstream`;
}

function base64ToBytes(base64: string) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}
