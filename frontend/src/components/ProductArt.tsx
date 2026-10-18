import { memo, useId, useState } from 'react';
export const ProductArt = memo(function ProductArt({
  art = 'chair',
  color = '#bdc9ad',
  imageUrl,
  name = '',
  className = '',
  priority = false,
}: {
  art?: string;
  color?: string;
  imageUrl?: string;
  name?: string;
  className?: string;
  priority?: boolean;
}) {
  const uid = useId().replace(/:/g, '');
  const [loaded, setLoaded] = useState(''),
    [failed, setFailed] = useState('');
  if (imageUrl)
    return (
      <div className={`product-art photo-art ${className}`}>
        {loaded !== imageUrl && failed !== imageUrl && (
          <span className="skeleton-block photo-placeholder" aria-hidden="true" />
        )}
        {failed === imageUrl && <small className="photo-error">Image unavailable</small>}
        <img
          className="product-photo"
          onLoad={() => setLoaded(imageUrl)}
          onError={() => setFailed(imageUrl)}
          style={{ opacity: loaded === imageUrl ? 1 : 0 }}
          src={imageUrl}
          srcSet={
            imageUrl.startsWith('/media/')
              ? `${imageUrl}?size=card 480w, ${imageUrl} 1200w`
              : undefined
          }
          sizes="(max-width: 600px) 90vw, (max-width: 1000px) 45vw, 32vw"
          alt={name}
          loading={priority ? 'eager' : 'lazy'}
          fetchPriority={priority ? 'high' : 'auto'}
          decoding="async"
          width={500}
          height={500}
        />
      </div>
    );
  const fill = `url(#${uid}body)`,
    wood = `url(#${uid}wood)`;
  return (
    <svg
      viewBox="0 0 500 500"
      className={`product-art ${className}`}
      role="img"
      aria-label={name || `${art} illustration`}
    >
      <defs>
        <linearGradient id={`${uid}body`} x1="0" y1="0" x2=".8" y2="1">
          <stop stopColor={color} />
          <stop offset=".4" stopColor={color} />
          <stop offset="1" stopColor="#000" stopOpacity=".15" />
        </linearGradient>
        <linearGradient id={`${uid}wood`} x2="1" y2=".6">
          <stop stopColor="#d7c8a7" />
          <stop offset=".45" stopColor="#b7a080" />
          <stop offset=".7" stopColor="#d4c09c" />
          <stop offset="1" stopColor="#9a8061" />
        </linearGradient>
        <linearGradient id={`${uid}shade`}>
          <stop stopColor="#c7bd9f" />
          <stop offset=".35" stopColor="#f9f4de" />
          <stop offset=".65" stopColor="#eae3cc" />
          <stop offset="1" stopColor="#c7bfa7" />
        </linearGradient>
        <radialGradient id={`${uid}shadow`}>
          <stop stopColor="#373528" stopOpacity=".22" />
          <stop offset="1" stopColor="#373528" stopOpacity="0" />
        </radialGradient>
        <filter id={`${uid}soft`}>
          <feGaussianBlur stdDeviation="5" />
        </filter>
      </defs>
      <ellipse cx="265" cy="432" rx="164" ry="25" fill={`url(#${uid}shadow)`} />
      {(art === 'chair' || art === 'sofa') && (
        <g transform={art === 'sofa' ? 'translate(-22 20) scale(1.08 .86)' : 'translate(0 -10)'}>
          <path
            d="M145 345l-19 91q6 8 13 0l31-84M347 347l30 87q8 5 12-3l-17-89M196 359l-8 96q5 7 12 0l16-91"
            fill={wood}
          />
          <path
            d="M125 180Q108 140 148 126Q232 96 333 140Q357 158 354 196L348 328 176 340Z"
            fill={fill}
          />
          <path d="M132 185Q160 167 182 199L219 303 190 363 147 341Z" fill={fill} />
          <path d="M174 277Q250 252 349 278L369 327Q348 367 190 370Q158 346 174 277Z" fill={fill} />
          <path d="M325 218Q356 189 375 216L396 305Q398 338 372 354L345 330Z" fill={fill} />
          <path
            d="M170 300Q243 271 356 298"
            fill="none"
            stroke="#fff"
            strokeOpacity=".15"
            strokeWidth="3"
          />
          <path
            d="M147 160Q240 126 325 155"
            fill="none"
            stroke="#fff"
            strokeOpacity=".13"
            strokeWidth="2"
          />
        </g>
      )}
      {art === 'lamp' && (
        <g>
          <path
            d="M242 240L238 351Q237 378 221 402Q214 420 250 423Q286 420 277 402Q262 377 261 352L258 240Z"
            fill={fill}
          />
          <ellipse cx="250" cy="412" rx="28" ry="9" fill={wood} />
          <path d="M180 115Q247 99 320 115L342 257Q252 279 158 257Z" fill={`url(#${uid}shade)`} />
          {Array.from({ length: 29 }, (_, i) => (
            <path
              key={i}
              d={`M${180 + i * 5} 115L${158 + i * 6.55} 257`}
              stroke="#9a8f72"
              strokeOpacity=".28"
              strokeWidth="1.5"
            />
          ))}
          <ellipse cx="250" cy="115" rx="70" ry="13" fill="#eee7d3" />
          <ellipse cx="250" cy="257" rx="92" ry="10" fill="#d6cdb5" />
          <path d="M180 115Q250 132 320 115" fill="none" stroke="#fff" strokeOpacity=".7" />
        </g>
      )}
      {art === 'pendant' && (
        <g>
          <path d="M250 0v142" stroke="#80735c" strokeWidth="2" />
          <path d="M235 137h30v18h-30" fill={wood} />
          <path
            d="M250 147C210 149 225 171 196 183C131 209 121 255 133 291C149 360 347 360 367 291C382 240 350 205 307 183C276 169 285 150 250 147Z"
            fill={`url(#${uid}shade)`}
          />
          {Array.from({ length: 20 }, (_, i) => (
            <ellipse
              key={i}
              cx="250"
              cy={170 + i * 8}
              rx={Math.min(117, 20 + Math.sin((i / 20) * Math.PI) * 102)}
              ry={6 + Math.sin((i / 20) * Math.PI) * 9}
              fill="none"
              stroke="#9c947e"
              strokeOpacity=".32"
              strokeWidth="1.3"
            />
          ))}
          <ellipse cx="250" cy="341" rx="30" ry="6" fill="#b4aa91" opacity=".7" />
        </g>
      )}
      {art === 'table' && (
        <g>
          <path
            d="M155 264l-15 157h22l26-154M317 264l24 157h21l-11-157M236 283l5 157h21l10-157"
            fill={wood}
          />
          <ellipse cx="250" cy="258" rx="148" ry="59" fill="#a68b67" />
          <ellipse cx="250" cy="244" rx="148" ry="58" fill={wood} />
          <ellipse
            cx="250"
            cy="240"
            rx="137"
            ry="48"
            fill="none"
            stroke="#f2dfbb"
            strokeOpacity=".3"
          />
        </g>
      )}
      {art === 'vase' && (
        <g>
          <path
            d="M211 158Q250 150 288 158L279 226C281 250 329 285 322 348Q322 406 250 413Q178 407 178 350C171 286 220 247 220 225Z"
            fill={fill}
          />
          <ellipse cx="250" cy="158" rx="39" ry="10" fill="#897963" />
          <ellipse cx="250" cy="158" rx="29" ry="6" fill="#5f5545" />
          <path
            d="M201 309Q196 362 216 389"
            fill="none"
            stroke="#fff"
            strokeOpacity=".17"
            strokeWidth="14"
          />
        </g>
      )}
      {art === 'textile' && (
        <g transform="rotate(-12 250 260)">
          <path d="M139 164L359 164 369 391 128 391Z" fill={fill} />
          {Array.from({ length: 38 }, (_, i) => (
            <path
              key={i}
              d={`M${139 + i * 5.8} 164L${128 + i * 6.35} 391`}
              stroke="#eee5d4"
              strokeWidth="2"
              strokeOpacity=".35"
            />
          ))}
          {Array.from({ length: 25 }, (_, i) => (
            <path key={i} d={`M130 ${174 + i * 8.5}h237`} stroke="#897f6b" strokeOpacity=".15" />
          ))}
          <path d="M139 164L250 150 359 164 250 190Z" fill="#e1d5bf" />
          {Array.from({ length: 25 }, (_, i) => (
            <path key={i} d={`M${130 + i * 9.7} 391v20`} stroke={color} strokeWidth="3" />
          ))}
        </g>
      )}
    </svg>
  );
});
