import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from './lib/session'

const OPENBAAR = ['/login', '/api/auth/login', '/api/webhooks', '/api/cron']

// Paden die docenten mogen gebruiken; al het andere is alleen voor management.
const DOCENT_PADEN = ['/docent', '/rooster', '/api/presentie', '/api/lessen', '/api/auth/logout']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (OPENBAAR.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get('session')?.value
  const session = token ? await verifySessionToken(token) : null

  if (!session) {
    if (pathname.startsWith('/api')) return NextResponse.json({ error: 'Niet ingelogd' }, { status: 401 })
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (session.rol === 'docent' && !DOCENT_PADEN.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/docent', req.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
