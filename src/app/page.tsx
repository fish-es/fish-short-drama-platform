import { redirect } from 'next/navigation'
import AuthenticatedApp from '@/components/AuthenticatedApp'
import { getCurrentUser } from '@/services/auth.service'

export default async function Page() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')
  return <AuthenticatedApp user={user} />
}
