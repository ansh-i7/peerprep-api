import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { supabase } from './supabase'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'PeerPrep API is running' })
})

app.get('/match/:userId', async (req, res) => {
  const { userId } = req.params

  // Get the requesting user's profile
  const { data: myProfile, error: myError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (myError || !myProfile) {
    return res.status(404).json({ matched: false, error: 'Profile not found' })
  }

  // Check if already matched
  const { data: existingMatch } = await supabase
    .from('matches')
    .select('*')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .eq('subject', myProfile.subject)
    .maybeSingle()

  if (existingMatch) {
    const partnerId = existingMatch.user_a === userId ? existingMatch.user_b : existingMatch.user_a
    const { data: partnerProfile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', partnerId)
      .single()

    return res.json({ matched: true, match: existingMatch, partner: partnerProfile })
  }

  // Find a candidate: same subject, overlapping time, not self
  const { data: candidates, error: candError } = await supabase
    .from('profiles')
    .select('*')
    .eq('subject', myProfile.subject)
    .neq('id', userId)
    .lte('available_from', myProfile.available_to)
    .gte('available_to', myProfile.available_from)

  if (candError || !candidates || candidates.length === 0) {
    return res.json({ matched: false })
  }

  const partner = candidates[0]

  const { data: newMatch, error: matchError } = await supabase
    .from('matches')
    .insert({ user_a: userId, user_b: partner.id, subject: myProfile.subject })
    .select()
    .single()

  if (matchError) {
    return res.status(500).json({ matched: false, error: matchError.message })
  }

  return res.json({ matched: true, match: newMatch, partner })
})

const PORT = process.env.PORT || 4000
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})