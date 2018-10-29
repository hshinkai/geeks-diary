import { DatePipe } from '@angular/common';
import { Injectable } from '@angular/core';
import * as path from 'path';
import { Observable, zip } from 'rxjs';
import { map, mapTo } from 'rxjs/operators';
import { Asset, AssetTypes, getFilePathDescription } from '../../../core/asset';
import { Note } from '../../../core/note';
import { FsService, WorkspaceService } from '../../shared';
import { NoteItem } from '../note-collection';
import { convertToNoteSnippets, NoteParser } from '../note-shared';
import { NoteContent } from './note-content.model';


@Injectable()
export class NoteEditorService {
    constructor(
        private fs: FsService,
        private parser: NoteParser,
        private datePipe: DatePipe,
        private workspace: WorkspaceService,
    ) {
    }

    copyAssetFile(type: AssetTypes, file: File): Observable<Asset> {
        const { fileName, extension } = getFilePathDescription(file.path);
        const destination = path.resolve(this.workspace.configs.assetsDirPath, fileName);

        const asset: Asset = {
            type,
            fileName,
            filePath: destination,
            extension,
        };

        return this.fs.copyFile(file.path, destination, {
            overwrite: false,
            errorOnExist: true,
        }).pipe(mapTo(asset));
    }

    loadNoteContent(noteItem: NoteItem): Observable<NoteContent> {
        return zip(
            this.fs.readJsonFile<Note>(noteItem.filePath),
            this.fs.readFile(noteItem.contentFilePath),
        ).pipe(map(([note, contentRawValue]) => this.parser.generateNoteContent(note, contentRawValue)));
    }

    saveNote(noteItem: NoteItem, content: NoteContent): Observable<void> {
        const parseResult = this.parser.parseNoteContent(content, {
            metadata: {
                title: noteItem.title,
                date: this.datePipe.transform(noteItem.createdDatetime, 'E, d MMM yyyy HH:mm:ss Z'),
                stacks: noteItem.stackIds,
            },
        });

        const note: Note = {
            id: noteItem.id,
            title: noteItem.title,
            snippets: convertToNoteSnippets(parseResult.parsedSnippets),
            stackIds: noteItem.stackIds,
            contentFileName: noteItem.contentFileName,
            contentFilePath: noteItem.contentFilePath,
            createdDatetime: noteItem.createdDatetime,
            updatedDatetime: new Date().getTime(),
        };

        return zip(
            this.fs.writeJsonFile<Note>(noteItem.filePath, note),
            this.fs.writeFile(noteItem.contentFilePath, parseResult.contentRawValue),
        ).pipe(mapTo(null));
    }
}
