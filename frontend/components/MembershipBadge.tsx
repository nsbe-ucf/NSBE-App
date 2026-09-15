import { Badge } from "./ui/badge";

interface MembershipBadgeProps {
  chapterMembershipActive: boolean | null;
  className?: string;
}

export function MembershipBadge({
  chapterMembershipActive,
  className,
}: MembershipBadgeProps) {
  const unknown = chapterMembershipActive === null;
  return (
    <Badge
      className={
        unknown
          ? `bg-white/10 text-white/70 border-2 border-white/20 ${className ?? ""}`
          : chapterMembershipActive
            ? `bg-[#00a651] text-white border-2 border-black ${className ?? ""}`
            : `bg-white/20 text-white/90 border-2 border-white/30 ${className ?? ""}`
      }
    >
      {unknown
        ? "Chapter Dues: Unknown"
        : chapterMembershipActive
          ? "Chapter Dues: Paid"
          : "Chapter Dues: Unpaid"}
    </Badge>
  );
}
