import { supabase } from './supabase'

export const DEFAULT_APPLY_MESSAGE =
  'היי! ראיתי את המודעה שלך ואני מעוניין/ת. אשמח לשמוע עוד פרטים.'

/**
 * Full 5-step apply flow. Returns the conversation_id to navigate to.
 * If the user already applied, returns the existing conversation_id immediately.
 * On any failure after step 2, best-effort rollback of the conversation row.
 */
export const applyToListing = async (
  listingId: string,
  ownerId: string,
  applicantId: string,
  message: string
): Promise<string> => {
  // Step 1 — check for existing application
  const { data: existingApp } = await supabase
    .from('applications')
    .select('conversation_id')
    .eq('listing_id', listingId)
    .eq('applicant_id', applicantId)
    .maybeSingle()

  if (existingApp?.conversation_id) {
    return existingApp.conversation_id as string
  }

  // Step 2 — create conversation
  const { data: conv, error: convErr } = await supabase
    .from('conversations')
    .insert({ listing_id: listingId, user_a: applicantId, user_b: ownerId })
    .select('id')
    .single()

  if (convErr || !conv) throw new Error(convErr?.message ?? 'שגיאה ביצירת שיחה')
  const conversationId = conv.id as string

  try {
    // Step 3 — create application
    const { error: appErr } = await supabase.from('applications').insert({
      listing_id: listingId,
      applicant_id: applicantId,
      conversation_id: conversationId,
      status: 'pending',
    })
    if (appErr) throw new Error(appErr.message)

    // Step 4 — send first message
    const { error: msgErr } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: applicantId,
      content: message,
    })
    if (msgErr) throw new Error(msgErr.message)

    // Step 5 — notify listing owner
    const { error: notifErr } = await supabase.from('notifications').insert({
      user_id: ownerId,
      type: 'application',
      payload: {
        listing_id: listingId,
        from_user_id: applicantId,
        conversation_id: conversationId,
      },
    })
    if (notifErr) throw new Error(notifErr.message)

    return conversationId
  } catch (err) {
    // Best-effort rollback — delete the conversation we just created
    await supabase.from('conversations').delete().eq('id', conversationId)
    throw err
  }
}
