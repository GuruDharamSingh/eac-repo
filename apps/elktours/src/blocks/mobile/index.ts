import type { Block } from "@elkdonis/blocks";
import "./blocks.css";
import "./people.css";
import "./places-feed.css";
import { mPageTitle } from "./m-page-title";
import { mTourList } from "./m-tour-list";
import { mMasthead, mSearchRow, mFeaturedTour, mPlacesShelf, mExperiencesPanel, mGuides, mLinkRows } from "./discover";
import { mExperienceList, mArtistsRow, mSuggestPill, mPeopleGrid, mPeopleSlider, mAboutPhoto, mProseSections, mExpHero, mExpFacts, mExpBody, mExpTours, mExpDates, mExpPrivate } from "./people-exp";
import { mPlacesCatalogue, mFeedList } from "./places-feed";
import { mPageButtons } from "./page-buttons";
import { mPhoneMenu } from "./phone-menu";
import { mTourTopbar, mTourHero, mTourHead, mTourBlurb, mTourMeet, mTourRoute, mTourDates, mTourBookbar } from "./tour";

/** The phone blocks, in palette order. Registered as MOBILE_BLOCKS in lib/puck/catalogue.ts. */
export const MOBILE_BLOCK_LIST: Block<never>[] = [
  mPageTitle, mTourList,
  mMasthead, mSearchRow, mFeaturedTour, mPlacesShelf, mExperiencesPanel, mGuides, mLinkRows,
  mExperienceList, mArtistsRow, mSuggestPill, mPeopleGrid, mPeopleSlider, mAboutPhoto, mProseSections,
  mExpHero, mExpFacts, mExpBody, mExpTours, mExpDates, mExpPrivate,
  mTourTopbar, mTourHero, mTourHead, mTourBlurb, mTourMeet, mTourRoute, mTourDates, mTourBookbar,
  mPlacesCatalogue, mFeedList,
  mPageButtons, mPhoneMenu,
] as unknown as Block<never>[];
export { TOUR_TYPE_KEYS, type MobileTourRow } from "./types";
