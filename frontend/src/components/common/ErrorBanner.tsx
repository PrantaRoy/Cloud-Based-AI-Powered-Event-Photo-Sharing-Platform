export function ErrorBanner({ message }: { message: string }) {
  return <div className="border border-gray-900 bg-gray-50 px-3 py-2 text-sm text-black">{message}</div>
}
