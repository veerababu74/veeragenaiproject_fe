import { ArrowDown, Repeat } from 'lucide-react'
import { useInsideLLMStore } from './store'

/* The whole stack in one picture.
 *
 * Drawn as nested boxes rather than a flowchart because the structure being
 * taught is containment — a block contains attention and a feed-forward network,
 * and the stack contains twelve identical blocks. An arrow diagram hides that. */

export default function Architecture() {
  const { example, overview } = useInsideLLMStore()
  const model = overview?.model
  const tokens = example?.tokens?.length ?? 0

  return (
    <div className="ill-architecture">
      <header className="ill-arch-head">
        <h3>The whole model, in one view</h3>
        <p>
          Everything below runs once per token, in parallel across all {tokens || 'n'} positions.
          The twelve blocks are identical in shape and differ only in their learned weights.
        </p>
      </header>

      <div className="ill-stack">
        <div className="ill-stage input">
          <span className="ill-stage-tag">input</span>
          <h4>Text</h4>
          <code>{example?.text || 'a sentence'}</code>
        </div>
        <ArrowDown size={16} className="ill-arrow" />

        <div className="ill-stage">
          <span className="ill-stage-tag">1</span>
          <h4>Tokenize</h4>
          <p>Split into {tokens} tokens, each an index into a {model?.vocab.toLocaleString()}-entry vocabulary.</p>
        </div>
        <ArrowDown size={16} className="ill-arrow" />

        <div className="ill-stage">
          <span className="ill-stage-tag">2</span>
          <h4>Embed and add position</h4>
          <p>Each index becomes a {model?.d_model}-dimension vector; the position vector is added to it.</p>
          <code className="ill-shape">[{tokens} × {model?.d_model}]</code>
        </div>
        <ArrowDown size={16} className="ill-arrow" />

        <div className="ill-blocks">
          <div className="ill-blocks-label">
            <Repeat size={14} />
            <span>× {model?.layers} identical blocks</span>
          </div>

          <div className="ill-block">
            <div className="ill-residual-line" aria-hidden="true" />

            <div className="ill-sub">
              <span className="ill-sub-tag">a</span>
              <div>
                <h5>LayerNorm → Multi-head attention</h5>
                <p>
                  {model?.heads} heads of {model && model.d_model / model.heads} dimensions. The only
                  step where information moves between positions.
                </p>
              </div>
            </div>
            <div className="ill-add">+ add to residual stream</div>

            <div className="ill-sub">
              <span className="ill-sub-tag">b</span>
              <div>
                <h5>LayerNorm → Feed-forward</h5>
                <p>{model?.d_model} → {model && model.d_model * 4} → {model?.d_model}, with GELU between.
                   Applied to each position independently.</p>
              </div>
            </div>
            <div className="ill-add">+ add to residual stream</div>
          </div>
        </div>
        <ArrowDown size={16} className="ill-arrow" />

        <div className="ill-stage">
          <span className="ill-stage-tag">3</span>
          <h4>Final LayerNorm → unembed</h4>
          <p>
            Multiply by the transpose of the embedding table to score all{' '}
            {model?.vocab.toLocaleString()} tokens, then softmax.
          </p>
          <code className="ill-shape">[{tokens} × {model?.vocab.toLocaleString()}]</code>
        </div>
        <ArrowDown size={16} className="ill-arrow" />

        <div className="ill-stage output">
          <span className="ill-stage-tag">output</span>
          <h4>A probability for every token</h4>
          {example && (
            <code>
              most likely: {example.prediction.top[0].token.replaceAll(' ', '␣')}{' '}
              at {(example.prediction.top[0].probability * 100).toFixed(1)}%
            </code>
          )}
        </div>
      </div>

      <div className="ill-arch-notes">
        <div>
          <h5>Where the parameters are</h5>
          <p>
            About two thirds sit in the feed-forward blocks and one third in attention. The intuition
            that attention is "the model" is wrong by parameter count — attention is the routing, and
            the feed-forward layers are most of the storage.
          </p>
        </div>
        <div>
          <h5>What runs in parallel</h5>
          <p>
            All positions pass through the stack at once during a forward pass. Generation is
            sequential only because each new token has to be appended before the next pass can start.
          </p>
        </div>
        <div>
          <h5>Why depth helps</h5>
          <p>
            Each block reads the residual stream and adds a correction. Early layers resolve local
            structure; later ones assemble the answer, which is exactly what the logit lens makes
            visible.
          </p>
        </div>
      </div>
    </div>
  )
}
