import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { AppComponent } from './app.component';
@NgModule({ declarations: [AppComponent], imports: [BrowserModule, BrowserAnimationsModule, FormsModule], bootstrap: [AppComponent] })
export class AppModule {}
