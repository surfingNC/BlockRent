import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

function Lightbox({ images, index, onClose }) {
  const [current, setCurrent] = useState(index || 0);

  const next = () => setCurrent((prev) => (prev + 1) % images.length);
  const prev = () => setCurrent((prev) => (prev - 1 + images.length) % images.length);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999999
      }}
      onClick={onClose}
    >

      {/* ✅ GUARANTEED VISIBLE CLOSE BUTTON */}
      <button
        onClick={onClose}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000000,
          background: 'red',
          color: 'white',
          width: '50px',
          height: '50px',
          fontSize: '28px',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer'
        }}
      >
        ×
      </button>

      <div onClick={(e) => e.stopPropagation()}>

        {images.length > 1 && (
          <button
            onClick={prev}
            style={{
              position: 'absolute',
              left: '20px',
              color: 'white',
              fontSize: '30px',
              background: 'none',
              border: 'none'
            }}
          >
            ‹
          </button>
        )}

        <img
          src={images[current]}
          alt="Preview"
          style={{
            maxWidth: '85vw',
            maxHeight: '85vh',
            objectFit: 'contain'
          }}
        />

        {images.length > 1 && (
          <button
            onClick={next}
            style={{
              position: 'absolute',
              right: '20px',
              color: 'white',
              fontSize: '30px',
              background: 'none',
              border: 'none'
            }}
          >
            ›
          </button>
        )}

      </div>
    </div>,
    document.body
  );
}

export default Lightbox;