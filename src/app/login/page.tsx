import { redirect } from 'next/navigation'
import AuthForm from '@/components/auth/AuthForm'
import { getCurrentUser } from '@/services/auth.service'

export default async function LoginPage() {
  if (await getCurrentUser()) redirect('/')

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090a0d] text-white">
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-stretch lg:grid-cols-[1.15fr_.85fr]">
        <section className="hidden border-r border-white/10 px-12 py-14 lg:flex lg:flex-col lg:justify-between">
          <div className="flex items-center gap-3 text-sm font-medium text-zinc-300">
            <span className="grid size-9 place-items-center rounded-md bg-red-500 font-bold text-white">F</span>
            短剧开发平台
          </div>

          <div className="max-w-lg pb-10">
            <div className="mb-8 flex h-56 items-end gap-3 border-y border-white/10 py-6" aria-hidden="true">
              {[42, 68, 54, 86, 63, 100, 78, 92, 58, 72, 48, 64].map((height, index) => (
                <span key={index} className="flex-1 bg-zinc-700 transition-colors even:bg-cyan-300/70" style={{ height: `${height}%` }} />
              ))}
            </div>
            <p className="text-4xl font-semibold leading-tight text-zinc-100">让每一次创作，都从熟悉的工作台继续。</p>
          </div>

          <p className="text-xs text-zinc-600">FISH SHORT DRAMA STUDIO</p>
        </section>

        <section className="flex min-h-screen items-center justify-center px-6 py-12 sm:px-12">
          <div className="w-full max-w-sm">
            <div className="mb-12 flex items-center gap-3 text-sm font-medium text-zinc-300 lg:hidden">
              <span className="grid size-9 place-items-center rounded-md bg-red-500 font-bold text-white">F</span>
              短剧开发平台
            </div>
            <AuthForm />
          </div>
        </section>
      </div>
    </main>
  )
}
