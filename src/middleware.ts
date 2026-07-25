import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Supabase 인증 호출이 이 시간을 넘기면 백엔드 장애로 간주한다.
// (무료 Supabase 프로젝트가 비활성으로 일시정지되면 호스트가 응답하지 않아
//  미들웨어가 그대로 멈추고 Vercel이 504 MIDDLEWARE_INVOCATION_TIMEOUT을 반환한다.)
const AUTH_TIMEOUT_MS = 3000

class AuthTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new AuthTimeoutError('auth timeout')), ms)
    ),
  ])
}

// supabase-js의 getUser()는 네트워크 실패 시 예외를 던지지 않고
// { error: AuthRetryableFetchError, status: 0 } 형태로 반환한다.
// 이를 백엔드 장애로 간주한다. (세션 없음 등 정상적 인증 실패(status 400/401)는 제외)
function isBackendUnavailable(error: { name?: string; status?: number } | null): boolean {
  if (!error) return false
  return (
    error.name === 'AuthRetryableFetchError' ||
    error.status === 0 ||
    (typeof error.status === 'number' && error.status >= 500)
  )
}

/**
 * 로그인 후 복귀 경로 검증. 같은 사이트 내부 경로만 허용한다.
 * startsWith('/') 검사만으로는 백슬래시('/\evil.com')가 WHATWG URL 파싱에서
 * '//evil.com'(외부 host)으로 해석돼 open redirect가 되므로, 첫 글자가 '/'이고
 * 두 번째 글자가 '/' 또는 '\'가 아닐 때만 안전한 내부 경로로 본다.
 */
function safeRedirect(redirect: string | null): string {
  if (!redirect) return '/dashboard'
  if (redirect[0] !== '/' || redirect[1] === '/' || redirect[1] === '\\') return '/dashboard'
  return redirect
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 장애 안내 페이지 자체는 인증 검사 없이 통과시킨다 (무한 루프 방지).
  if (pathname === '/service-unavailable') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  let user = null
  try {
    const result = await withTimeout(supabase.auth.getUser(), AUTH_TIMEOUT_MS)
    if (isBackendUnavailable(result.error)) {
      throw result.error
    }
    user = result.data.user
  } catch (error) {
    // 백엔드(Supabase) 연결 실패/타임아웃 → 504로 죽지 않고 안내 페이지를 보여준다.
    console.error('[middleware] Supabase auth check failed:', error)
    const url = request.nextUrl.clone()
    url.pathname = '/service-unavailable'
    // URL은 유지한 채 안내 화면만 렌더링(rewrite). 상태 코드는 503으로 명시.
    return NextResponse.rewrite(url, { status: 503 })
  }

  // 로그인 필요 경로 → 미로그인 시 /login으로
  // (/costs·/map·/premium·/admin 도 모두 로그인 사용자 전용 화면 — 누락 시 미로그인 접근 때
  //  로그인으로 리다이렉트되지 않고 빈/깨진 화면이 떠서 함께 포함한다. 데이터 자체는 RLS·
  //  API 인가로 보호되지만, 미들웨어 게이트는 올바른 리다이렉트·심층 방어를 위해 필요.)
  const protectedPaths = ['/dashboard', '/pets', '/foods', '/health', '/care', '/walk', '/info', '/community', '/profile', '/schedule', '/notifications', '/lost', '/invite', '/costs', '/map', '/premium', '/admin']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url)
    // 로그인 후 원래 가려던 곳(예: 초대 수락 링크)으로 복귀하도록 목적지 보존
    loginUrl.searchParams.set('redirect', pathname + request.nextUrl.search)
    return NextResponse.redirect(loginUrl)
  }

  // 이미 로그인한 사용자가 /login 접근 시 → 보존된 목적지(없으면 /dashboard)로
  if (pathname === '/login' && user) {
    const redirect = request.nextUrl.searchParams.get('redirect')
    return NextResponse.redirect(new URL(safeRedirect(redirect), request.url))
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|offline|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
