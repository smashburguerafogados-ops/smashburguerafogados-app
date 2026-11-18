import { useState } from 'react'

export type Choice = {
  value: string
  label: string
}

type ChoiceListProps = {
  label: string
  value: string
  choices: Choice[]
  onChange: (value: string) => void
}

export function ChoiceList({ label, value, choices, onChange }: ChoiceListProps) {
  const [open, setOpen] = useState(false)
  const current = choices.find((choice) => choice.value === value)

  return (
    <div className="choice">
      <button
        type="button"
        className={open ? 'choice__button is-open' : 'choice__button'}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((currentOpen) => !currentOpen)}
      >
        <span>{current?.label ?? 'Escolha'}</span>
        <span className="choice__mark" aria-hidden="true" />
      </button>
      {open && (
        <ul className="choice__list" role="listbox" aria-label={label}>
          {choices.map((choice) => {
            const selected = choice.value === value
            return (
              <li key={choice.value || 'empty'}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={selected ? 'choice__option is-active' : 'choice__option'}
                  onClick={() => {
                    onChange(choice.value)
                    setOpen(false)
                  }}
                >
                  {choice.label}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
