const listText = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ')
  return String(value || '').trim()
}

export default function UserGlossaryPanel({
  labels,
  authToken,
  glossaryTerms,
  glossaryLoading,
  glossaryActionId,
  glossaryForm,
  handleGlossaryFieldChange,
  handleCreateGlossaryTerm,
  handleToggleGlossaryTerm,
  handleDeleteGlossaryTerm,
  fetchGlossary,
}) {
  if (!authToken) return null

  const terms = Array.isArray(glossaryTerms) ? glossaryTerms : []
  const creating = glossaryActionId === '__create__'

  return (
    <div className="nm-raised p-4 sm:p-5 mb-5 animate-nm-card-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <h2 className="text-base sm:text-lg font-bold text-nm-text-primary">{labels.title}</h2>
        <button
          type="button"
          onClick={() => fetchGlossary()}
          disabled={glossaryLoading}
          className="nm-btn inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-nm-text-primary disabled:opacity-60"
        >
          {glossaryLoading ? labels.loading : labels.refresh}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <input
          type="text"
          value={glossaryForm.term}
          onChange={(event) => handleGlossaryFieldChange('term', event.target.value)}
          placeholder={labels.termPlaceholder}
          className="nm-concave w-full px-4 py-3 text-sm text-nm-text-primary placeholder:text-nm-text-secondary bg-transparent outline-none"
        />
        <input
          type="text"
          value={glossaryForm.meaning}
          onChange={(event) => handleGlossaryFieldChange('meaning', event.target.value)}
          placeholder={labels.meaningPlaceholder}
          className="nm-concave w-full px-4 py-3 text-sm text-nm-text-primary placeholder:text-nm-text-secondary bg-transparent outline-none"
        />
        <textarea
          value={glossaryForm.aliases}
          onChange={(event) => handleGlossaryFieldChange('aliases', event.target.value)}
          placeholder={labels.aliasesPlaceholder}
          rows={2}
          className="nm-concave w-full px-4 py-3 text-sm text-nm-text-primary placeholder:text-nm-text-secondary bg-transparent outline-none resize-none"
        />
        <textarea
          value={glossaryForm.contexts}
          onChange={(event) => handleGlossaryFieldChange('contexts', event.target.value)}
          placeholder={labels.contextsPlaceholder}
          rows={2}
          className="nm-concave w-full px-4 py-3 text-sm text-nm-text-primary placeholder:text-nm-text-secondary bg-transparent outline-none resize-none"
        />
      </div>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          onClick={handleCreateGlossaryTerm}
          disabled={creating}
          className="nm-btn-primary inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold disabled:opacity-60"
        >
          {creating ? labels.saving : labels.add}
        </button>
      </div>

      <div className="mt-4 divide-y divide-nm-text-secondary/20">
        {glossaryLoading && terms.length === 0 ? (
          <p className="py-4 text-sm text-nm-text-secondary">{labels.loading}</p>
        ) : null}
        {!glossaryLoading && terms.length === 0 ? (
          <p className="py-4 text-sm text-nm-text-secondary">{labels.empty}</p>
        ) : null}
        {terms.map((item) => {
          const termId = item?.id == null ? '' : String(item.id)
          const busy = glossaryActionId === termId
          const aliases = listText(item?.aliases)
          const contexts = listText(item?.contexts)
          return (
            <div key={`glossary-${termId || item?.term}`} className="py-3">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-nm-text-primary break-words">{item?.term}</p>
                    <span className="rounded-full border border-nm-text-secondary/30 px-2 py-0.5 text-[11px] font-semibold text-nm-text-secondary">
                      {item?.is_active ? labels.active : labels.inactive}
                    </span>
                  </div>
                  {item?.meaning ? (
                    <p className="mt-1 text-xs text-nm-text-secondary break-words">{item.meaning}</p>
                  ) : null}
                  {aliases ? (
                    <p className="mt-1 text-[11px] text-nm-text-secondary break-words">{labels.aliasesLabel}: {aliases}</p>
                  ) : null}
                  {contexts ? (
                    <p className="mt-1 text-[11px] text-nm-text-secondary break-words">{labels.contextsLabel}: {contexts}</p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleToggleGlossaryTerm(termId, !item?.is_active)}
                    disabled={busy}
                    className="nm-btn inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-nm-text-primary disabled:opacity-60"
                  >
                    {item?.is_active ? labels.disable : labels.enable}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteGlossaryTerm(termId)}
                    disabled={busy}
                    className="nm-btn inline-flex items-center justify-center px-3 py-2 text-xs font-semibold text-red-500 disabled:opacity-60"
                  >
                    {busy ? labels.deleting : labels.delete}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
