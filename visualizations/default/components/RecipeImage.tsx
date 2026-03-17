import React from 'react';

export function RecipeImage({ image, title, servings, prepTime, cookTime }: {
  image: string;
  title: string;
  servings: string;
  prepTime: string;
  cookTime: string;
}) {
  const metaParts = [servings, prepTime, cookTime].filter(Boolean);

  return (
    <div className="rcp-image-wrap">
      {image && (
        <img
          className="rcp-image"
          src={`data:image/jpeg;base64,${image}`}
          alt={title}
        />
      )}
      <div className="rcp-image-overlay">
        <div className="rcp-image-title">{title}</div>
        {metaParts.length > 0 && (
          <div className="rcp-image-meta">
            {metaParts.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
