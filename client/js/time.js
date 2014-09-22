function Time(hour, minute) {
  this.hour = Number(hour);
  this.minute = Number(minute);
}
Time.fromString = function(timeString) {
  var parts = /^(\d?\d):(\d\d) (AM|PM)$/.exec(timeString);
  if (parts) {
    return new Time(Number(parts[1]) + (parts[3] == 'PM' ? 12 : 0), Number(parts[2]));
  }
  
  parts = /^(\d\d):(\d\d):(\d\d)$/.exec(timeString);
  if (parts) {
    return new Time(parts[1], parts[2]);
  }
};
Time.fromMinutesSinceStart = function (minutes) {
  return new Time(Math.floor(minutes / 60), minutes % 60);
};
Time.prototype = {
  minutesSinceStart: function () {
    return this.hour * 60 + this.minute;
  },
  minus: function(arg1, arg2) {
    if (arg1 instanceof Time) {
      return Time.fromMinutesSinceStart(this.minutesSinceStart() - timeObject.minutesSinceStart());
    }
    if (arg2 === undefined) {
      return Time.fromMinutesSinceStart(this.minutesSinceStart() - arg1);
    }
    return Time.fromMinutesSinceStart(this.minutesSinceStart() - Time.fromMinutesSinceStart(arg1, arg2));
  },
  plus: function (arg1, arg2) {
    if (arg1 instanceof Time) {
      return Time.fromMinutesSinceStart(this.minutesSinceStart() + timeObject.minutesSinceStart());
    }
    if (arg2 === undefined) {
      return Time.fromMinutesSinceStart(this.minutesSinceStart() + arg1);
    }
    return Time.fromMinutesSinceStart(this.minutesSinceStart() + Time.fromMinutesSinceStart(arg1, arg2));
  },
  valueOf: function() {
    return this.minutesSinceStart();
  },
  toString: function() {
    return ("0"+this.hour).slice(-2)+":"+("0"+Math.floor(this.minute)).slice(-2)+":"+("0"+Math.floor((this.minute%1)*60)).slice(-2);
  }
};

try {
  exports.Time = Time;
} catch (e) {
  // guess we're on the client!
}