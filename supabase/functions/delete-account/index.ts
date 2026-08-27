import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = (request: Request) => {
  const allowedOrigin = Deno.env.get('ALLOWED_ORIGIN')
  const origin = request.headers.get('Origin')
  const isLocal = (Deno.env.get('SUPABASE_URL') ?? '').includes('127.0.0.1') || (Deno.env.get('SUPABASE_URL') ?? '').includes('localhost')
  const originAllowed = isLocal
    ? origin === 'http://localhost:5173' || origin === 'http://127.0.0.1:5173'
    : Boolean(allowedOrigin && origin === allowedOrigin)
  if (!originAllowed) return null
  return {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Origin': origin!,
    Vary: 'Origin',
  }
}

Deno.serve(async request => {
  const headers = corsHeaders(request)
  if (!headers) return Response.json({ error: 'Origin not allowed' }, { status: 403 })
  if (request.method === 'OPTIONS') return new Response('ok', { headers })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Authentication required' }, { status: 401, headers })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) {
    console.error('Supabase function environment is not configured')
    return Response.json({ error: 'Server configuration error' }, { status: 500, headers })
  }

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Authentication required' }, { status: 401, headers })

  const adminClient = createClient(url, serviceRoleKey)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false)
  if (deleteError) {
    console.error('Account deletion failed', deleteError)
    return Response.json({ error: 'Account deletion failed' }, { status: 500, headers })
  }

  return Response.json({ deleted: true }, { headers })
})
