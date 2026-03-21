import Anthropic from 'npm:@anthropic-ai/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { goalName, targetAmount, currentAmount, percentComplete, remainingAmount } =
      await req.json()

    const client = new Anthropic()

    const message = await client.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 600,
      messages: [{
        role:    'user',
        content: `I am saving for "${goalName}". I have saved €${Number(currentAmount).toFixed(2)} of my €${Number(targetAmount).toFixed(2)} goal — that is ${percentComplete}% complete with €${Number(remainingAmount).toFixed(2)} remaining.

Give me exactly 3 concise, personalized, actionable saving tips to help me reach this goal faster.

Respond ONLY with valid JSON in this exact format, no extra text:
{"tips":[{"title":"short tip headline","description":"1-2 sentence practical advice"},{"title":"...","description":"..."},{"title":"...","description":"..."}]}`
      }],
    })

    const raw = message.content[0].type === 'text' ? message.content[0].text : ''

    let tips = null
    try {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) tips = JSON.parse(match[0]).tips
    } catch {
      console.error('[generate-savings-tips] JSON parse failed:', raw)
    }

    return new Response(JSON.stringify({ tips }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[generate-savings-tips] error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status:  500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
