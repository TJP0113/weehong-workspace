/** Vehicle photo shown on the vehicle card and page heroes. */
export const TRUCK_PHOTO = '/truck-white.webp';
export function TruckArt({ alt = '车辆照片' }: { alt?: string }) {
  return (
    <div className="hero-photo" style={{ flex: 'none', margin: '4px 0 10px', maxWidth: 'none', width: '100%' }}>
      <img src={TRUCK_PHOTO} alt={alt} width={1280} height={487} loading="lazy" />
    </div>
  );
}
