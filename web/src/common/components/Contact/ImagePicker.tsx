import React, { useEffect, useMemo, useRef, useState } from "react";
import { CONTACT_COPY } from "./copy";
import { fill } from "./copyText";
import { ACCEPTED_TYPES, ImageError, prepareImage } from "./resizeImage";
import { inputId } from "./Field";
import { CameraIcon } from "./icons";
import styles from "./styles.module.scss";

interface ImagePickerProps {
  name: string;
  maxFiles: number;
  files: File[];
  onChange: (files: File[]) => void;
  /** An error code from preparing a picture (unsupported_image, file_too_large, too_many_files). */
  onError: (code: string | null) => void;
}

function useObjectUrls(files: File[]) {
  const urls = useMemo(() => files.map((file) => URL.createObjectURL(file)), [files]);
  useEffect(() => () => urls.forEach((url) => URL.revokeObjectURL(url)), [urls]);
  return urls;
}

export default function ImagePicker({ name, maxFiles, files, onChange, onError }: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const urls = useObjectUrls(files);
  const copy = CONTACT_COPY.images;
  const isFull = files.length >= maxFiles;

  function onDrop(event: React.DragEvent) {
    event.preventDefault();
    setDragging(false);
    if (!isFull && !processing) addFiles(event.dataTransfer.files);
  }

  async function addFiles(selected: FileList | null) {
    if (!selected?.length) return;
    const room = maxFiles - files.length;
    const picked = Array.from(selected).slice(0, room);
    let error: string | null = selected.length > room ? "too_many_files" : null;
    setProcessing(true);
    const ready: File[] = [];
    for (const file of picked) {
      try {
        ready.push(await prepareImage(file));
      } catch (e) {
        error = e instanceof ImageError ? e.code : "unsupported_image";
      }
    }
    setProcessing(false);
    onChange([...files, ...ready]);
    onError(error);
  }

  function removeAt(index: number) {
    onChange(files.filter((_, i) => i !== index));
    onError(null);
  }

  return (
    <div className={styles.images}>
      {files.length > 0 && (
        <ul className={styles.thumbs}>
          {files.map((file, index) => (
            <li key={urls[index]} className={styles.thumb}>
              <img src={urls[index]} alt="" />
              <button type="button" className={styles.thumb_remove} aria-label={copy.remove} onClick={() => removeAt(index)}>
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
      {!isFull && (
        <button
          type="button"
          id={inputId(name)}
          className={styles.dropzone}
          data-dragging={dragging ? "" : undefined}
          disabled={processing}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <span className={styles.dropzone_icon} aria-hidden="true">
            <CameraIcon />
          </span>
          <span className={styles.dropzone_title}>
            {processing ? copy.processing : dragging ? copy.dropHere : maxFiles === 1 ? copy.addOne : copy.add}
          </span>
          <span className={styles.dropzone_hint}>
            <span className={styles.dropzone_drag}>{maxFiles === 1 ? copy.dropHintOne : copy.dropHint} · </span>
            {maxFiles === 1 ? copy.limitOne : fill(copy.limit, { max: maxFiles })}
          </span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={ACCEPTED_TYPES.join(",")}
        multiple={maxFiles > 1}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
