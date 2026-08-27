import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return Response.json({ error: 'Method not allowed' }, { status: 405, headers: corsHeaders })

  const authorization = request.headers.get('Authorization')
  if (!authorization) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })

  const url = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !anonKey || !serviceRoleKey) {
    console.error('Supabase function environment is not configured')
    return Response.json({ error: 'Server configuration error' }, { status: 500, headers: corsHeaders })
  }

  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } })
  const { data: { user }, error: userError } = await userClient.auth.getUser()
  if (userError || !user) return Response.json({ error: 'Authentication required' }, { status: 401, headers: corsHeaders })

  const adminClient = createClient(url, serviceRoleKey)
  const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id, false)
  if (deleteError) {
    console.error('Account deletion failed', deleteError)
    return Response.json({ error: 'Account deletion failed' }, { status: 500, headers: corsHeaders })
  }

  return Response.json({ deleted: true }, { headers: corsHeaders })
})
