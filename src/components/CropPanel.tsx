import { useEffect, useId, useState } from 'react'
import { Check, RotateCcw } from 'lucide-react'
import type { ImageCrop, SlideBlock } from '../types'
import { getImageCrop, resolveImagePlacement, type NaturalImageSize } from '../lib/imageCrop'
import { Modal } from './Modal'
import './brand-tools.css'

export interface CropPanelProps {
  image: NonNullable<SlideBlock['image']>
  frame: { width: number; height: number }
  onApply: (crop: ImageCrop) => void
  onClose: () => void
}

export function CropPanel({ image, frame, onApply, onClose }: CropPanelProps) {
  const [crop, setCrop] = useState(() => getImageCrop(image))
  const [natural, setNatural] = useState<NaturalImageSize | null>(null)
  const [error, setError] = useState('')
  const [confirmClose, setConfirmClose] = useState(false)
  const clipId = 'crop-' + useId().replace(/[^\w-]/g, '')
  const validFrame =
    frame.width > 0 &&
    frame.height > 0 &&
    Number.isFinite(frame.width) &&
    Number.isFinite(frame.height)
  const dirty = JSON.stringify(crop) !== JSON.stringify(getImageCrop(image))
  useEffect(() => {
    let active = true
    setNatural(null)
    if (!image.src) {
      setError('Escolha uma imagem enviada para ajustar o recorte.')
      return
    }
    const decoded = new Image()
    const timer = window.setTimeout(() => {
      if (active) setError('A imagem demorou para abrir. Feche e tente novamente.')
    }, 15000)
    decoded.onload = () => {
      window.clearTimeout(timer)
      if (!active) return
      if (decoded.naturalWidth > 0 && decoded.naturalHeight > 0) {
        setNatural({ width: decoded.naturalWidth, height: decoded.naturalHeight })
        setError('')
      } else setError('Esta imagem não tem dimensões válidas. Substitua o arquivo no editor.')
    }
    decoded.onerror = () => {
      window.clearTimeout(timer)
      if (active) setError('Não foi possível abrir esta imagem. Substitua o arquivo no editor.')
    }
    decoded.src = image.src
    return () => {
      active = false
      window.clearTimeout(timer)
      decoded.onload = null
      decoded.onerror = null
    }
  }, [image.src])
  const box = { x: 0, y: 0, w: frame.width, h: frame.height }
  const placement =
    natural && validFrame
      ? resolveImagePlacement({ ...image, fit: 'cover', crop }, natural, box)
      : null
  function apply() {
    if (!natural || !validFrame) return
    try {
      onApply({ ...crop })
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível aplicar o recorte.')
    }
  }
  return (
    <Modal
      title="Ajustar recorte"
      wide
      onClose={() =>
        confirmClose ? setConfirmClose(false) : dirty ? setConfirmClose(true) : onClose()
      }
    >
      {confirmClose ? (
        <div className="brand-confirm" role="alert">
          <h3>Descartar este ajuste?</h3>
          <p>O enquadramento aplicado à imagem continua preservado.</p>
          <div className="brand-actions">
            <button className="button primary" autoFocus onClick={() => setConfirmClose(false)}>
              Continuar ajustando
            </button>
            <button className="button secondary" onClick={onClose}>
              Descartar ajuste
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="brand-intro">
            Ajuste a área visível da imagem. O arquivo incorporado permanece inteiro para você
            editar novamente.
          </p>
          <div className="crop-layout">
            <div className="crop-preview">
              {placement ? (
                <svg
                  viewBox={`0 0 ${frame.width} ${frame.height}`}
                  role="img"
                  aria-label="Prévia do recorte da imagem"
                >
                  <defs>
                    <clipPath id={clipId}>
                      <rect width={frame.width} height={frame.height} />
                    </clipPath>
                  </defs>
                  <rect width={frame.width} height={frame.height} fill="#EFF6FF" />
                  <image
                    href={image.src}
                    x={placement.x}
                    y={placement.y}
                    width={placement.w}
                    height={placement.h}
                    preserveAspectRatio="none"
                    clipPath={`url(#${clipId})`}
                  />
                  <path
                    d={`M${frame.width / 3} 0V${frame.height}M${(frame.width * 2) / 3} 0V${frame.height}M0 ${frame.height / 3}H${frame.width}M0 ${(frame.height * 2) / 3}H${frame.width}`}
                    stroke="#FFFFFF"
                    strokeOpacity="0.7"
                    strokeWidth="1"
                    vectorEffect="non-scaling-stroke"
                    fill="none"
                    pointerEvents="none"
                  />
                </svg>
              ) : (
                <p role="status">{error ? 'Prévia indisponível' : 'Abrindo imagem…'}</p>
              )}
            </div>
            <fieldset className="crop-controls" disabled={!natural || !validFrame}>
              <label>
                Zoom <output>{crop.zoom.toFixed(2).replace('.', ',')}×</output>
                <input
                  aria-label="Zoom do recorte"
                  type="range"
                  min={1}
                  max={4}
                  step={0.05}
                  value={crop.zoom}
                  onChange={(event) => setCrop({ ...crop, zoom: Number(event.target.value) })}
                />
              </label>
              <label>
                Posição horizontal <output>{Math.round(crop.x)}%</output>
                <input
                  aria-label="Posição horizontal do recorte"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={crop.x}
                  onChange={(event) => setCrop({ ...crop, x: Number(event.target.value) })}
                />
                <span>
                  Esquerda <span>Direita</span>
                </span>
              </label>
              <label>
                Posição vertical <output>{Math.round(crop.y)}%</output>
                <input
                  aria-label="Posição vertical do recorte"
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={crop.y}
                  onChange={(event) => setCrop({ ...crop, y: Number(event.target.value) })}
                />
                <span>
                  Topo <span>Base</span>
                </span>
              </label>
              <button
                className="button secondary"
                onClick={() => setCrop({ x: 50, y: 50, zoom: 1 })}
              >
                <RotateCcw size={15} />
                Redefinir
              </button>
              <p className="brand-small">
                Ao aplicar, a imagem usa o modo Preencher. As posições ajustam o excedente fora do
                quadro; aumente o zoom para aproximar.
              </p>
            </fieldset>
          </div>
          {!validFrame && (
            <p role="alert" className="inline-error">
              Este elemento ainda não tem um espaço válido no slide. Escolha outra composição antes
              de recortar.
            </p>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <div className="brand-footer-actions">
            <button
              className="button secondary"
              onClick={() => (dirty ? setConfirmClose(true) : onClose())}
            >
              Cancelar
            </button>
            <button className="button primary" disabled={!natural || !validFrame} onClick={apply}>
              <Check size={16} />
              Aplicar recorte
            </button>
          </div>
        </>
      )}
    </Modal>
  )
}

export default CropPanel
