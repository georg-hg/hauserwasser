export default function AdminFisherList({ fishers, onToggleLicense, onToggleBlock, onDeleteFisher, onSelectFisher, onExportFisher, onResetPassword, onChangeEmail, onChangeRole, currentYear }) {
  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Fischer</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">E-Mail</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Karten-Nr.</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Fänge {currentYear}</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Lizenz</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600">Status</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Aktionen</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fishers.map((f) => (
              <tr key={f.id} className={`hover:bg-gray-50 transition-colors ${f.blocked ? 'bg-red-50/50' : ''}`}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {f.blocked && (
                      <svg className="w-4 h-4 text-red-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span className={`font-medium ${f.blocked ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                      {f.lastName} {f.firstName}
                    </span>
                    {f.role === 'kontrolleur' && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                        Kontrolleur
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-600">{f.email}</td>
                <td className="px-4 py-3 text-gray-600">{f.fisherCardNr || '—'}</td>
                <td className="px-4 py-3 text-center">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {f.catchCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onToggleLicense(f.id, !!f.license)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      f.license
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-red-100 text-red-600 hover:bg-red-200'
                    }`}
                  >
                    {f.license ? (
                      <>
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                        Aktiv
                      </>
                    ) : 'Nicht freigeschaltet'}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => onToggleBlock(f.id, f.blocked)}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      f.blocked
                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                    title={f.blockedReason || ''}
                  >
                    {f.blocked ? 'Gesperrt' : 'Aktiv'}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onSelectFisher(f)}
                      className="text-primary-600 hover:text-primary-800 text-xs font-medium"
                    >
                      Fangbuch
                    </button>
                    <button
                      onClick={() => onChangeRole(f)}
                      className="text-purple-600 hover:text-purple-800 text-xs font-medium"
                      title={f.role === 'kontrolleur' ? 'Zu Fischer zurückstufen' : 'Zum Kontrolleur machen'}
                    >
                      {f.role === 'kontrolleur' ? '→ Fischer' : '→ Kontrolleur'}
                    </button>
                    <button
                      onClick={() => onResetPassword(f)}
                      className="text-amber-600 hover:text-amber-800 text-xs font-medium"
                    >
                      Passwort
                    </button>
                    <button
                      onClick={() => onChangeEmail(f)}
                      className="text-indigo-600 hover:text-indigo-800 text-xs font-medium"
                    >
                      E-Mail
                    </button>
                    <button
                      onClick={() => onExportFisher(f)}
                      className="text-green-600 hover:text-green-800 text-xs font-medium"
                    >
                      Excel
                    </button>
                    <button
                      onClick={() => onDeleteFisher(f)}
                      className="text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Löschen
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden divide-y divide-gray-100">
        {fishers.map((f) => (
          <div key={f.id} className={`p-4 space-y-3 ${f.blocked ? 'bg-red-50/50' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  {f.blocked && (
                    <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                    </svg>
                  )}
                  <p className={`font-medium ${f.blocked ? 'text-red-700 line-through' : 'text-gray-900'}`}>
                    {f.lastName} {f.firstName}
                  </p>
                  {f.role === 'kontrolleur' && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                      Kontrolleur
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">{f.email}</p>
                {f.fisherCardNr && <p className="text-xs text-gray-400">Nr. {f.fisherCardNr}</p>}
              </div>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                {f.catchCount} Fänge
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => onToggleLicense(f.id, !!f.license)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  f.license
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-600'
                }`}
              >
                {f.license ? 'Lizenz aktiv' : 'Nicht freigeschaltet'}
              </button>

              <button
                onClick={() => onToggleBlock(f.id, f.blocked)}
                className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  f.blocked
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {f.blocked ? 'Entsperren' : 'Sperren'}
              </button>
            </div>

            <div className="flex justify-end gap-3 flex-wrap">
              <button onClick={() => onSelectFisher(f)} className="text-primary-600 text-xs font-medium">
                Fangbuch
              </button>
              <button onClick={() => onChangeRole(f)} className="text-purple-600 text-xs font-medium">
                {f.role === 'kontrolleur' ? '→ Fischer' : '→ Kontrolleur'}
              </button>
              <button onClick={() => onResetPassword(f)} className="text-amber-600 text-xs font-medium">
                Passwort
              </button>
              <button onClick={() => onChangeEmail(f)} className="text-indigo-600 text-xs font-medium">
                E-Mail
              </button>
              <button onClick={() => onExportFisher(f)} className="text-green-600 text-xs font-medium">
                Excel
              </button>
              <button onClick={() => onDeleteFisher(f)} className="text-red-500 text-xs font-medium">
                Löschen
              </button>
            </div>
          </div>
        ))}
      </div>

      {fishers.length === 0 && (
        <div className="p-8 text-center text-gray-400">
          Noch keine Fischer registriert.
        </div>
      )}
    </div>
  );
}
