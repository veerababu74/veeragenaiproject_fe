/* The sampling maths, applied in the browser.
 *
 * Temperature, top-k, top-p and repetition penalty are pure functions of the
 * logits, so running them client-side is exact rather than approximate — and it
 * means a slider redraws instantly instead of costing a round trip.
 *
 * The backend ships the top 200 logits plus a histogram of the ~50,000 it left
 * out. The tail never wins, but it belongs in the partition function: at high
 * temperature it carries real mass, and dropping it would quietly overstate
 * every probability shown.
 */

/** Repetition penalty, applied to logits before temperature.
 *  Positive logits are divided and negative ones multiplied, so the penalty
 *  always moves a token down — dividing a negative logit would raise it. */
function penalise(logit, penalty, seen) {
  if (!seen || penalty === 1) return logit
  return logit > 0 ? logit / penalty : logit * penalty
}

export function applySampling(candidates, tail, options) {
  const {
    temperature = 1,
    topK = 0,
    topP = 1,
    repetitionPenalty = 1,
    promptTokenIds = [],
  } = options

  const seen = new Set(promptTokenIds)
  const t = Math.max(temperature, 0.01)

  const adjusted = candidates.map((candidate) => ({
    ...candidate,
    penalised: penalise(candidate.logit, repetitionPenalty, seen.has(candidate.id)),
  }))

  // Shift by the maximum before exponentiating. Softmax is shift-invariant, so
  // this changes nothing except whether exp() overflows.
  const scaled = adjusted.map((candidate) => candidate.penalised / t)
  const tailScaled = (tail || []).map((bucket) => ({ ...bucket, scaled: bucket.logit / t }))
  const max = Math.max(
    ...scaled,
    ...(tailScaled.length ? tailScaled.map((bucket) => bucket.scaled) : [-Infinity]),
  )

  const exponentials = scaled.map((value) => Math.exp(value - max))
  const tailMass = tailScaled.reduce(
    (total, bucket) => total + bucket.count * Math.exp(bucket.scaled - max), 0)
  const partition = exponentials.reduce((total, value) => total + value, 0) + tailMass

  const withProbabilities = adjusted.map((candidate, index) => ({
    ...candidate,
    probability: exponentials[index] / partition,
  }))

  // Truncation runs on the temperature-adjusted distribution, in the order the
  // providers apply it: top-k first, then top-p over what survives.
  const ordered = [...withProbabilities].sort((a, b) => b.probability - a.probability)
  const kept = new Set()

  const limit = topK > 0 ? Math.min(topK, ordered.length) : ordered.length
  const afterK = ordered.slice(0, limit)

  if (topP >= 1) {
    afterK.forEach((candidate) => kept.add(candidate.id))
  } else {
    let cumulative = 0
    for (const candidate of afterK) {
      kept.add(candidate.id)
      cumulative += candidate.probability
      // The token that crosses the threshold is kept, otherwise a p below the
      // top token's own probability would keep nothing at all.
      if (cumulative >= topP) break
    }
  }

  const keptMass = withProbabilities
    .filter((candidate) => kept.has(candidate.id))
    .reduce((total, candidate) => total + candidate.probability, 0)

  const result = withProbabilities.map((candidate) => ({
    ...candidate,
    kept: kept.has(candidate.id),
    // What you would actually sample from, after the survivors are renormalised.
    finalProbability: kept.has(candidate.id) && keptMass > 0
      ? candidate.probability / keptMass
      : 0,
  }))

  const final = result.filter((candidate) => candidate.kept)

  // Entropy of what you would actually sample from: the survivors, renormalised.
  const entropy = -final.reduce(
    (total, candidate) => total + (candidate.finalProbability > 0
      ? candidate.finalProbability * Math.log(candidate.finalProbability)
      : 0), 0)

  // Entropy of the whole distribution before any truncation, tail included.
  // Without the tail term this understates a flat distribution badly — on an
  // open-ended prompt more than half the mass sits outside the shipped top 200.
  const shippedEntropy = -withProbabilities.reduce(
    (total, candidate) => total + (candidate.probability > 0
      ? candidate.probability * Math.log(candidate.probability)
      : 0), 0)
  const tailEntropy = -tailScaled.reduce((total, bucket) => {
    const probability = Math.exp(bucket.scaled - max) / partition
    return probability > 0 ? total + bucket.count * probability * Math.log(probability) : total
  }, 0)

  return {
    candidates: result,
    stats: {
      keptCount: final.length,
      totalCount: candidates.length,
      keptMass,
      entropyFull: shippedEntropy + tailEntropy,
      // How much of the distribution sits below the shipped top-200. Large here
      // means the display is a smaller share of the truth than it looks.
      tailMass: tailMass / partition,
      entropy,
      perplexity: Math.exp(entropy),
      // A distribution's "effective" number of choices — 1 means decided.
      effectiveChoices: Math.exp(entropy),
      top: final[0] || null,
      greedy: ordered[0] || null,
    },
  }
}

/** One draw from the surviving distribution, for the "sample" button. */
export function drawSample(candidates, random = Math.random) {
  const target = random()
  let cumulative = 0
  for (const candidate of candidates) {
    if (!candidate.kept) continue
    cumulative += candidate.finalProbability
    if (cumulative >= target) return candidate
  }
  return candidates.find((candidate) => candidate.kept) || null
}
