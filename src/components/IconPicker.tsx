import { CATEGORY_ICONS, CategoryIcon, SELECTABLE_ICONS, autoIconForName, type CategoryIconKey } from '../lib/categoryIcons'

type Props = {
  name: string
  value: string
  onChange: (value: string) => void
}

export function IconPicker({ name, value, onChange }: Props) {
  const auto = autoIconForName(name)
  const shown: CategoryIconKey = value && value in CATEGORY_ICONS ? (value as CategoryIconKey) : auto
  const chosen = shown === auto && !value ? 'Automático' : CATEGORY_ICONS[shown].label

  return (
    <fieldset className="icon-picker">
      <legend>Ícone</legend>
      <div className="icon-picker__preview" aria-live="polite">
        <span className="icon-picker__pill">
          <CategoryIcon iconKey={shown} />
          {name.trim() || 'Categoria'}
        </span>
        <span className="muted">{chosen}</span>
      </div>
      <div className="icon-picker__grid" role="radiogroup" aria-label="Ícone da categoria">
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          aria-label="Automático"
          className={value ? 'icon-picker__cell icon-picker__cell--auto' : 'icon-picker__cell icon-picker__cell--auto is-selected'}
          onClick={() => onChange('')}
        >
          <CategoryIcon iconKey={auto} />
          <span>Automático</span>
        </button>
        {SELECTABLE_ICONS.map((key) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={value === key}
            aria-label={CATEGORY_ICONS[key].label}
            className={value === key ? 'icon-picker__cell is-selected' : 'icon-picker__cell'}
            onClick={() => onChange(key)}
          >
            <CategoryIcon iconKey={key} />
            <span>{CATEGORY_ICONS[key].label}</span>
          </button>
        ))}
      </div>
    </fieldset>
  )
}
