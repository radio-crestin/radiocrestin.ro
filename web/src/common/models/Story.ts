// The parts of a story the website's share page uses (backend/docs/stories-api.md).
export interface IStorySlide {
  id: number;
  type: string;
  media_url: string | null;
  poster_url: string | null;
}

export interface IStory {
  slug: string;
  title: string;
  cover_url: string | null;
  share_url: string;
  slides: IStorySlide[];
}
