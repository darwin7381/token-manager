import { useState } from 'react';

export default function TagInput({ tags, onChange }) {
  const [inputValue, setInputValue] = useState('');

  const addTag = () => {
    const tag = inputValue.trim();
    if (tag && !tags.includes(tag)) {
      onChange([...tags, tag]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  return (
    <>
      <div className="tag-input-container">
        <input
          type="text"
          className="tag-input"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="輸入標籤後按 Enter"
        />
        <button type="button" className="btn btn-small" onClick={addTag}>
          添加
        </button>
      </div>
      <div className="tags-display">
        {tags.map(tag => (
          <span key={tag} className="badge badge-warning tag-badge">
            {tag}
            <span className="tag-remove" onClick={() => removeTag(tag)}>
              &times;
            </span>
          </span>
        ))}
      </div>
    </>
  );
}

