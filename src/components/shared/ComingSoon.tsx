interface Props {
  page: string
  icon: string
  teaser: string
}

export function ComingSoon({ page, icon, teaser }: Props) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-8 bg-white min-h-[60vh]">
      <div className="w-18 h-18 rounded-full bg-purple-50 flex items-center justify-center mb-4">
        <i className={`ti ${icon} text-4xl text-purple-700`} />
      </div>
      <span className="text-xs font-medium text-purple-800 bg-purple-50 px-3 py-1 rounded-full mb-3">
        Coming soon
      </span>
      <h2 className="text-base font-medium text-gray-900 mb-2 text-center">{page}</h2>
      <p className="text-sm text-gray-500 text-center leading-relaxed">{teaser}</p>
    </div>
  )
}
