import { describe, it, expect, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImageLightbox } from './ImageLightbox';

describe('ImageLightbox', () => {
  it('src=null does not render anything', () => {
    render(<ImageLightbox src={null} onClose={vi.fn()} />);
    expect(screen.queryByTestId('image-lightbox')).toBeNull();
  });

  it('src non-null renders img + scrim + close button', () => {
    render(<ImageLightbox src="data:image/png;base64,XYZ" alt="题图" onClose={vi.fn()} />);
    expect(screen.getByTestId('image-lightbox')).toBeInTheDocument();
    expect(screen.getByTestId('image-lightbox-img')).toHaveAttribute('alt', '题图');
    expect(screen.getByTestId('image-lightbox-scrim')).toBeInTheDocument();
    expect(screen.getByTestId('image-lightbox-close')).toBeInTheDocument();
  });

  it('close button fires onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ImageLightbox src="x.png" onClose={onClose} />);
    await user.click(screen.getByTestId('image-lightbox-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('scrim click fires onClose', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ImageLightbox src="x.png" onClose={onClose} />);
    await user.click(screen.getByTestId('image-lightbox-scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key fires onClose when open', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src="x.png" onClose={onClose} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape key does not fire onClose when src=null', () => {
    const onClose = vi.fn();
    render(<ImageLightbox src={null} onClose={onClose} />);
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
