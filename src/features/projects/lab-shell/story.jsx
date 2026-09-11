import { useEffect, useState } from 'react'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

/* The beginner's way into a lab.
 *
 * Every lab in this project is built for someone who already knows the
 * vocabulary. They open on a control panel — strategies, metrics, sliders,
 * attack catalogues — which is exactly right for a reader who came to compare
 * something, and exactly wrong for one who does not yet know what the thing
 * being compared is. "Top-p" and "cosine similarity" and "byte-pair encoding"
 * are not entry points, and no amount of correct explanation beside them fixes
 * the fact that the page opens by asking you to choose.
 *
 * So each lab gets a story: a handful of scenes, one idea each, plain words, a
 * picture that moves, and a real number from the lab's own data underneath it.
 * The maths is never removed — every scene can reveal the equation it is
 * standing on — but it is never the first thing you meet either.
 *
 * This is the shared chrome. A lab supplies `scenes`; everything about how they
 * are paced, numbered and navigated lives here once, so the four labs cannot
 * drift into four different reading experiences.
 */

export default function LabStory({ scenes, finishLabel = 'Open the lab', onFinish, footer }) {
  const [index, setIndex] = useState(0)
  const [showMaths, setShowMaths] = useState(false)

  // A different set of scenes is a different story, so start it from the top.
  useEffect(() => { setIndex(0) }, [scenes.length])

  if (!scenes?.length) return null
  const scene = scenes[Math.min(index, scenes.length - 1)]
  const Icon = scene.icon
  const last = index === scenes.length - 1

  return (
    <div className="lab-story">
      <div className="lab-story-progress">
        {scenes.map((item, position) => (
          <button key={item.id}
                  className={`lab-story-dot ${position === index ? 'active' : ''} ${
                    position < index ? 'done' : ''}`}
                  title={item.title}
                  onClick={() => setIndex(position)} />
        ))}
      </div>

      <article className="lab-story-scene" key={scene.id}>
        <span className="lab-story-chapter">
          {Icon && <Icon size={13} />} {scene.chapter}
        </span>
        <h2>{scene.title}</h2>
        <p className="lab-story-lead">{scene.lead}</p>

        {scene.visual && <div className="lab-story-visual">{scene.visual}</div>}

        {scene.body && <p className="lab-story-body">{scene.body}</p>}

        {scene.maths && (
          <div className="lab-story-maths">
            <button onClick={() => setShowMaths(!showMaths)}>
              {showMaths ? 'Hide the maths' : 'Show me the maths'}
            </button>
            {showMaths && (
              <div className="lab-story-maths-body">
                <code>{scene.maths.equation}</code>
                <p>{scene.maths.note}</p>
              </div>
            )}
          </div>
        )}
      </article>

      <div className="lab-story-nav">
        <button className="lab-story-back" onClick={() => setIndex(Math.max(0, index - 1))}
                disabled={index === 0}>
          <ChevronLeft size={16} /> Back
        </button>
        <span className="lab-story-count">{index + 1} of {scenes.length}</span>
        {last ? (
          <button className="lab-story-next" onClick={onFinish}>
            {finishLabel} <ArrowRight size={16} />
          </button>
        ) : (
          <button className="lab-story-next" onClick={() => setIndex(index + 1)}>
            Next <ChevronRight size={16} />
          </button>
        )}
      </div>

      {footer && <p className="lab-story-footer">{footer}</p>}
    </div>
  )
}
