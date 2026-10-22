export function Brand({ small = false }: { small?: boolean }) {
  return (
    <span className={'brand' + (small ? ' brand-small' : '')}>
      <img src="/zetta.svg" alt="" />
      <span>
        zetta<span className="brand-dot">.</span>
      </span>
    </span>
  )
}
