import { partyLogo } from './partyLogos'

type Props = {
  sigla: string
  color: string
  size?: number
  title?: string
}

export function PartyLogo({ sigla, color, size = 22, title }: Props) {
  return (
    <span
      className="party-mark"
      style={{ width: size, height: size, background: color }}
      title={title ?? sigla}
    >
      <span className="party-mark-txt" style={{ fontSize: Math.max(7, Math.round(size * 0.3)) }}>
        {sigla}
      </span>
      <img
        className="party-mark-img"
        src={partyLogo(sigla)}
        alt={sigla}
        loading="lazy"
        decoding="async"
        onError={(event) => {
          event.currentTarget.style.display = 'none'
        }}
      />
    </span>
  )
}
