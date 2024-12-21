export class TUPriorityManager {
  constructor(priorities) {
    this.priorities = priorities;
  }

  compareTranslationUnits(existingTU, newTU) {
    // Check creation ID priority
    if (this.priorities.creationId) {
      const existingCreationId = existingTU['@_creationid'];
      const newCreationId = newTU['@_creationid'];
      
      if (newCreationId === this.priorities.creationId && existingCreationId !== this.priorities.creationId) {
        return true;
      }
      if (existingCreationId === this.priorities.creationId && newCreationId !== this.priorities.creationId) {
        return false;
      }
    }

    // Check change ID priority
    if (this.priorities.changeId) {
      const existingChangeId = existingTU['@_changeid'];
      const newChangeId = newTU['@_changeid'];
      
      if (newChangeId === this.priorities.changeId && existingChangeId !== this.priorities.changeId) {
        return true;
      }
      if (existingChangeId === this.priorities.changeId && newChangeId !== this.priorities.changeId) {
        return false;
      }
    }

    // Check change date priority
    if (this.priorities.changeDate) {
      const existingChangeDate = existingTU['@_changedate'];
      const newChangeDate = newTU['@_changedate'];
      
      if (this.isDateNewer(newChangeDate, existingChangeDate)) {
        return true;
      }
      if (this.isDateNewer(existingChangeDate, newChangeDate)) {
        return false;
      }
    }

    // Check creation date priority
    if (this.priorities.creationDate) {
      const existingCreationDate = existingTU['@_creationdate'];
      const newCreationDate = newTU['@_creationdate'];
      
      if (this.isDateNewer(newCreationDate, existingCreationDate)) {
        return true;
      }
      if (this.isDateNewer(existingCreationDate, newCreationDate)) {
        return false;
      }
    }

    // Default to keeping existing entry if no priority rules match
    return false;
  }

  isDateNewer(date1, date2) {
    if (!date1 || !date2) return false;
    return new Date(date1) > new Date(date2);
  }
}
