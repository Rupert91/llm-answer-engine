import ResultItemComponent from "./ResultItemComponent";
export interface SearchResult {
  favicon?: string;
  link: string;
  title: string;
  snippet: any;
  position: number;
}

export interface SearchResultsComponentProps {
  searchResults: SearchResult[];
}

const ResultsListComponent = ({
  searchResults,
  count,
}: {
  searchResults: SearchResult[];
  count: number;
}) => {
console.log(searchResults);

  const visibleResults =
    searchResults.length < count
      ? searchResults
      : searchResults.slice(0, count);

  return (
    <div className="dark:bg-slate-800 bg-white shadow-lg rounded-lg p-4 mt-4">
      <div className="flex flex-wrap my-2">
        {searchResults.length !== 0 && (
          visibleResults.map((item, index) => 
            <ResultItemComponent item={item} key={index} />
          ))
        }
      </div>
    </div>
  );
};

export default ResultsListComponent;