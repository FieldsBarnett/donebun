import * as Icons from "lucide-react";

interface CategoryIconProps {
  name?: string;
  size?: number;
  className?: string;
}

export default function CategoryIcon({ name, size = 16, className = "" }: CategoryIconProps) {
  if (!name) return <Icons.Tag size={size} className={className} />;
  
  const IconComponent = (Icons as any)[name];
  
  if (!IconComponent) {
    return <Icons.Tag size={size} className={className} />;
  }
  
  return <IconComponent size={size} className={className} />;
}
