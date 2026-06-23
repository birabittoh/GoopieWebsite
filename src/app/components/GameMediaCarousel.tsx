import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from './ui/carousel';

interface GameMediaCarouselProps {
  mediaLinks: string[];
}

export function GameMediaCarousel({ mediaLinks }: GameMediaCarouselProps) {
  if (mediaLinks.length === 0) return null;

  return (
    <div className="p-6 rounded-lg shadow" style={{ backgroundColor: 'var(--theme-card-bg)', backdropFilter: 'var(--theme-backdrop-blur)', WebkitBackdropFilter: 'var(--theme-backdrop-blur)' }}>
      <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--theme-text-primary)' }}>Media</h2>
      <Carousel className="w-full max-w-2xl mx-auto">
        <CarouselContent>
          {mediaLinks.map((link, idx) => (
            <CarouselItem key={idx} className="flex items-center justify-center h-52 md:h-96 bg-black/20 rounded-lg overflow-hidden">
              {link.match(/(youtube\.com|youtu\.be)/i) ? (
                <iframe
                  width="100%"
                  height="100%"
                  src={
                    link.includes('embed')
                      ? link
                      : link.replace('watch?v=', 'embed/')
                  }
                  title="YouTube video player"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0 rounded-lg"
                />
              ) : (
                <img
                  src={link}
                  alt={`Media ${idx + 1}`}
                  className="object-contain w-full h-full rounded-lg"
                />
              )}
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="flex justify-between mt-2">
          <CarouselPrevious />
          <CarouselNext />
        </div>
      </Carousel>
    </div>
  );
}
